import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { quotes, verificationEvents, verificationRequests, revisions } from "@/db/schema";
import {
  ApiError,
  handleApiError,
  optionalString,
  persistUser,
  readJsonObject,
  requiredString,
  requireApiUser,
} from "../../_lib/http";
import {
  createVerificationRequest,
  getStripeCheckoutConfig,
  normalizeVerificationTier,
  stripeRequest,
  type StripeCheckoutSession,
} from "../../_lib/verification";

export async function POST(request: Request) {
  try {
    const user = requireApiUser(request);
    const body = await readJsonObject(request);
    const db = getDb();
    await persistUser(db, user);
    const config = await getStripeCheckoutConfig(db);
    if ("missing" in config) {
      const message = `Payment checkout is not configured. Configure ${config.missing.join(" and ")} to enable paid lab verification.`;
      return Response.json(
        { error: message, code: "payment_not_configured", missing: config.missing },
        { status: 503 },
      );
    }

    let verificationRequest;
    let quote;
    if (body.requestId) {
      const requestId = requiredString(body.requestId, "requestId", 100);
      [verificationRequest] = await db
        .select()
        .from(verificationRequests)
        .where(eq(verificationRequests.id, requestId))
        .limit(1);
      if (!verificationRequest || verificationRequest.userId !== user.userId) {
        throw new ApiError(404, "not_found", "Verification request not found.");
      }
      [quote] = await db
        .select()
        .from(quotes)
        .where(eq(quotes.verificationRequestId, requestId))
        .orderBy(desc(quotes.createdAt))
        .limit(1);
    } else {
      const revisionId = requiredString(body.revisionId, "revisionId", 100);
      const tier = normalizeVerificationTier(body.tier ?? body.serviceLevel);
      const notes = optionalString(body.notes, "notes", 5_000);
      const created = await createVerificationRequest(db, user, {
        revisionId,
        tier,
        notes,
      });
      verificationRequest = created.request;
      quote = created.quote;
    }
    if (!verificationRequest || !quote) {
      throw new ApiError(409, "quote_missing", "A current quote is required.");
    }
    if (["paid", "in_review", "verified"].includes(verificationRequest.status)) {
      throw new ApiError(
        409,
        "already_paid",
        "This verification request has already been paid.",
      );
    }
    if (quote.status !== "open") {
      throw new ApiError(409, "quote_not_open", "This quote is no longer open.");
    }
    if (quote.amountCents < 100) {
      throw new ApiError(
        409,
        "custom_quote_required",
        "This campaign needs an engineer-approved quote before checkout.",
      );
    }
    if (new Date(quote.validUntil).getTime() < Date.now()) {
      await db.update(quotes).set({ status: "expired" }).where(eq(quotes.id, quote.id));
      throw new ApiError(409, "quote_expired", "This quote has expired.");
    }

    let idempotencyKey = `verification-${verificationRequest.id}-${quote.id}`;
    if (verificationRequest.stripeCheckoutSessionId) {
      const existing = await stripeRequest<StripeCheckoutSession>(
        config,
        `/v1/checkout/sessions/${encodeURIComponent(verificationRequest.stripeCheckoutSessionId)}`,
      );
      if (existing.status === "open" && existing.url) {
        return Response.json({
          url: existing.url,
          sessionId: existing.id,
          requestId: verificationRequest.id,
        });
      }
      idempotencyKey = `${idempotencyKey}-${Date.now()}`;
    }

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", `${config.origin}/account?checkout=verification&session_id={CHECKOUT_SESSION_ID}`);
    form.set(
      "cancel_url",
      `${config.origin}/lab?checkout=cancelled&requestId=${encodeURIComponent(verificationRequest.id)}&revisionId=${encodeURIComponent(verificationRequest.revisionId)}&tier=${encodeURIComponent(verificationRequest.serviceLevel.replaceAll("_", "-"))}`,
    );
    form.set("customer_email", user.email);
    form.set("client_reference_id", verificationRequest.id);
    form.set("line_items[0][price_data][currency]", quote.currency);
    form.set("line_items[0][price_data][unit_amount]", String(quote.amountCents));
    form.set(
      "line_items[0][price_data][product_data][name]",
      verificationRequest.serviceLevel === "release_review"
        ? "Revision release review"
        : "Bench reproduction deposit",
    );
    form.set(
      "line_items[0][price_data][product_data][description]",
      `Revision-bound lab service for revision ${verificationRequest.revisionId}`,
    );
    form.set("line_items[0][quantity]", "1");
    form.set("metadata[verification_request_id]", verificationRequest.id);
    form.set("metadata[revision_id]", verificationRequest.revisionId);
    form.set(
      "payment_intent_data[metadata][verification_request_id]",
      verificationRequest.id,
    );

    const session = await stripeRequest<StripeCheckoutSession>(
      config,
      "/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": idempotencyKey,
        },
        body: form,
      },
    );
    if (!session.id || !session.url) {
      throw new ApiError(
        502,
        "payment_provider_error",
        "Stripe did not return a hosted checkout URL.",
      );
    }

    const now = new Date().toISOString();
    const fromStatus = verificationRequest.status;
    await db
      .update(verificationRequests)
      .set({
        status: "payment_pending",
        stripeCheckoutSessionId: session.id,
        updatedAt: now,
      })
      .where(eq(verificationRequests.id, verificationRequest.id));
    const [revision] = await db
      .select({ verificationStatus: revisions.verificationStatus })
      .from(revisions)
      .where(eq(revisions.id, verificationRequest.revisionId))
      .limit(1);
    if (
      revision &&
      !["paid", "in_review", "verified"].includes(revision.verificationStatus)
    ) {
      await db
        .update(revisions)
        .set({ verificationStatus: "payment_pending" })
        .where(eq(revisions.id, verificationRequest.revisionId));
    }
    await db.insert(verificationEvents).values({
      id: crypto.randomUUID(),
      verificationRequestId: verificationRequest.id,
      actorUserId: user.userId,
      type: "checkout_created",
      fromStatus,
      toStatus: "payment_pending",
      message: "Hosted Stripe Checkout created for this revision.",
      metadataJson: JSON.stringify({ checkoutSessionId: session.id }),
    });

    return Response.json({
      url: session.url,
      sessionId: session.id,
      requestId: verificationRequest.id,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return handleApiError(error);
  }
}
