import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { verificationRequests } from "@/db/schema";
import {
  ApiError,
  handleApiError,
  readJsonObject,
  requiredString,
  requireActiveApiUser,
  requireApiUser,
} from "../../../_lib/http";
import {
  applyPaidStripeSession,
  getStripeCheckoutConfig,
  stripeRequest,
  type StripeCheckoutSession,
} from "../../../_lib/verification";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id")?.trim();
  return reconcile(request, sessionId);
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    return reconcile(request, requiredString(body.sessionId, "sessionId", 200));
  } catch (error) {
    return handleApiError(error);
  }
}

async function reconcile(request: Request, sessionId?: string | null) {
  try {
    if (!sessionId) {
      throw new ApiError(400, "invalid_field", "session_id is required.");
    }
    const db = getDb();
    const user = await requireActiveApiUser(request, db);
    const config = await getStripeCheckoutConfig(db);
    if ("missing" in config) {
      return Response.json(
        {
          error: `Payment checkout is not configured. Configure ${config.missing.join(" and ")}.`,
          code: "payment_not_configured",
        },
        { status: 503 },
      );
    }
    const session = await stripeRequest<StripeCheckoutSession>(
      config,
      `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    );
    const requestId = session.metadata?.verification_request_id;
    if (!requestId) {
      throw new ApiError(404, "not_found", "Verification checkout not found.");
    }
    const [verificationRequest] = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.id, requestId))
      .limit(1);
    if (!verificationRequest || verificationRequest.userId !== user.userId) {
      throw new ApiError(404, "not_found", "Verification checkout not found.");
    }
    const updated = await applyPaidStripeSession(db, session);
    return Response.json({
      paid: session.payment_status === "paid",
      paymentStatus: session.payment_status ?? "unknown",
      request: updated ?? verificationRequest,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
