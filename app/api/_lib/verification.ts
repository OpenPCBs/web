import { and, desc, eq, inArray } from "drizzle-orm";
import { getBindings, type Database } from "@/db";
import {
  designs,
  quotes,
  revisions,
  verificationEvents,
  verificationRequests,
} from "@/db/schema";
import type { ChatGPTUser } from "@/app/chatgpt-auth";
import { ApiError } from "./http";

export type VerificationTier =
  | "release_review"
  | "bench_reproduction"
  | "custom_campaign";

export function verificationPricing() {
  const bindings = getBindings();
  return {
    release_review: {
      amountCents: envPrice(bindings.LAB_RELEASE_REVIEW_PRICE_CENTS, 29_900),
      currency: "usd",
      label: "Revision release review",
    },
    bench_reproduction: {
      amountCents: envPrice(bindings.LAB_BENCH_REPRODUCTION_PRICE_CENTS, 125_000),
      currency: "usd",
      label: "Bench reproduction deposit",
    },
    custom_campaign: {
      amountCents: 0,
      currency: "usd",
      label: "Custom verification campaign",
    },
  } as const;
}

export function normalizeVerificationTier(value: unknown): VerificationTier {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (normalized === "standard") return "release_review";
  if (normalized === "priority") return "bench_reproduction";
  if (
    normalized === "release_review" ||
    normalized === "bench_reproduction" ||
    normalized === "custom_campaign"
  ) {
    return normalized;
  }
  throw new ApiError(400, "invalid_field", "Unknown verification tier.");
}

export async function createVerificationRequest(
  db: Database,
  user: ChatGPTUser,
  input: { revisionId: string; tier: VerificationTier; notes?: string },
) {
  const [target] = await db
    .select({
      revision: revisions,
      designId: designs.id,
      designTitle: designs.title,
      designOwnerId: designs.ownerId,
      publicationStatus: designs.publicationStatus,
    })
    .from(revisions)
    .innerJoin(designs, eq(revisions.designId, designs.id))
    .where(eq(revisions.id, input.revisionId))
    .limit(1);
  if (
    !target ||
    (target.publicationStatus !== "published" && target.designOwnerId !== user.userId)
  ) {
    throw new ApiError(
      404,
      "revision_not_found",
      input.revisionId.startsWith("demo-")
        ? "Choose a real published design revision before commissioning verification."
        : "Revision not found.",
    );
  }

  const [active] = await db
    .select()
    .from(verificationRequests)
    .where(
      and(
        eq(verificationRequests.userId, user.userId),
        eq(verificationRequests.revisionId, input.revisionId),
        eq(verificationRequests.serviceLevel, input.tier),
        inArray(verificationRequests.status, [
          "quoted",
          "payment_pending",
          "paid",
          "in_review",
          "verified",
        ]),
      ),
    )
    .orderBy(desc(verificationRequests.createdAt))
    .limit(1);
  if (active) {
    const [quote] = await db
      .select()
      .from(quotes)
      .where(eq(quotes.verificationRequestId, active.id))
      .orderBy(desc(quotes.createdAt))
      .limit(1);
    return { request: active, quote, created: false };
  }

  const pricing = verificationPricing()[input.tier];
  const requestId = crypto.randomUUID();
  const quoteId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const now = new Date();
  const validUntil = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const lineItems = [
    {
      code: input.tier,
      description: pricing.label,
      amountCents: pricing.amountCents,
      quantity: 1,
    },
  ];

  await db.insert(verificationRequests).values({
    id: requestId,
    userId: user.userId,
    designId: target.designId,
    revisionId: target.revision.id,
    serviceLevel: input.tier,
    notes: input.notes?.slice(0, 5_000) ?? "",
    amountCents: pricing.amountCents,
    currency: pricing.currency,
    updatedAt: now.toISOString(),
  });
  try {
    await db.insert(quotes).values({
      id: quoteId,
      verificationRequestId: requestId,
      amountCents: pricing.amountCents,
      currency: pricing.currency,
      lineItemsJson: JSON.stringify(lineItems),
      validUntil: validUntil.toISOString(),
      updatedAt: now.toISOString(),
    });
    await db.insert(verificationEvents).values({
      id: eventId,
      verificationRequestId: requestId,
      actorUserId: user.userId,
      type: "quote_created",
      fromStatus: target.revision.verificationStatus,
      toStatus: "quoted",
      message:
        pricing.amountCents > 0
          ? "Verification scope created and ready for checkout."
          : "Custom campaign submitted for a scoped quote.",
      metadataJson: JSON.stringify({ tier: input.tier, quoteId }),
    });
    if (
      ["unverified", "failed", "cancelled"].includes(
        target.revision.verificationStatus,
      )
    ) {
      await db
        .update(revisions)
        .set({ verificationStatus: "quoted" })
        .where(eq(revisions.id, target.revision.id));
    }
  } catch (error) {
    await db
      .delete(verificationRequests)
      .where(eq(verificationRequests.id, requestId));
    throw error;
  }

  const [createdRequest] = await db
    .select()
    .from(verificationRequests)
    .where(eq(verificationRequests.id, requestId))
    .limit(1);
  const [createdQuote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);
  return { request: createdRequest, quote: createdQuote, created: true };
}

export function getStripeCheckoutConfig():
  | { secretKey: string; origin: string }
  | { missing: string[] } {
  const bindings = getBindings();
  const missing: string[] = [];
  const secretKey = bindings.STRIPE_SECRET_KEY?.trim();
  const configuredOrigin = bindings.APP_ORIGIN?.trim();
  if (!secretKey) missing.push("STRIPE_SECRET_KEY");
  if (!configuredOrigin) missing.push("APP_ORIGIN");
  if (missing.length) return { missing };

  try {
    const parsed = new URL(configuredOrigin!);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
      return { missing: ["APP_ORIGIN (must be an HTTPS origin)"] };
    }
    return { secretKey: secretKey!, origin: parsed.origin };
  } catch {
    return { missing: ["APP_ORIGIN (must be a valid origin)"] };
  }
}

export async function stripeRequest<T>(
  config: { secretKey: string },
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`https://api.stripe.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json()) as T & {
    error?: { message?: string; type?: string };
  };
  if (!response.ok) {
    console.error("Stripe API error", response.status, payload.error?.type);
    throw new ApiError(
      502,
      "payment_provider_error",
      payload.error?.message ?? "Stripe could not create the checkout session.",
    );
  }
  return payload;
}

export type StripeCheckoutSession = {
  id: string;
  url?: string | null;
  status?: string;
  payment_status?: string;
  payment_intent?: string | { id?: string } | null;
  amount_total?: number | null;
  currency?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string>;
};

export async function applyPaidStripeSession(
  db: Database,
  session: StripeCheckoutSession,
) {
  const requestId = session.metadata?.verification_request_id;
  if (!requestId || session.payment_status !== "paid") return null;
  const [verificationRequest] = await db
    .select()
    .from(verificationRequests)
    .where(eq(verificationRequests.id, requestId))
    .limit(1);
  if (!verificationRequest) return null;
  if (
    verificationRequest.stripeCheckoutSessionId &&
    verificationRequest.stripeCheckoutSessionId !== session.id
  ) {
    throw new ApiError(409, "session_mismatch", "Checkout session does not match.");
  }
  if (
    session.amount_total !== verificationRequest.amountCents ||
    session.currency?.toLowerCase() !== verificationRequest.currency.toLowerCase()
  ) {
    throw new ApiError(409, "amount_mismatch", "Checkout total does not match the quote.");
  }

  const alreadyRecorded = ["paid", "in_review", "verified"].includes(
    verificationRequest.status,
  );
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const now = new Date().toISOString();
  await db
    .update(verificationRequests)
    .set({
      status: alreadyRecorded ? verificationRequest.status : "paid",
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      paidAt: verificationRequest.paidAt ?? now,
      updatedAt: now,
    })
    .where(eq(verificationRequests.id, requestId));
  await db
    .update(quotes)
    .set({ status: "accepted", acceptedAt: now, updatedAt: now })
    .where(
      and(
        eq(quotes.verificationRequestId, requestId),
        eq(quotes.status, "open"),
      ),
    );

  const [revision] = await db
    .select()
    .from(revisions)
    .where(eq(revisions.id, verificationRequest.revisionId))
    .limit(1);
  if (
    revision &&
    !["paid", "in_review", "verified"].includes(revision.verificationStatus)
  ) {
    await db
      .update(revisions)
      .set({ verificationStatus: "paid" })
      .where(eq(revisions.id, revision.id));
  }
  if (!alreadyRecorded) {
    await db.insert(verificationEvents).values({
      id: crypto.randomUUID(),
      verificationRequestId: requestId,
      actorUserId: null,
      type: "payment_succeeded",
      fromStatus: verificationRequest.status,
      toStatus: "paid",
      message: "Stripe confirmed payment for this revision-bound verification.",
      metadataJson: JSON.stringify({ checkoutSessionId: session.id }),
    });
  }
  const [updated] = await db
    .select()
    .from(verificationRequests)
    .where(eq(verificationRequests.id, requestId))
    .limit(1);
  return updated;
}

function envPrice(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 100 && parsed <= 10_000_000
    ? parsed
    : fallback;
}
