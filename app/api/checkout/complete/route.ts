import { eq, inArray } from "drizzle-orm";
import { getEffectiveStripeSecrets } from "@/app/admin-settings";
import { stripeRequest } from "@/app/api/_lib/verification";
import { getDb } from "@/db";
import { orderItems, orders } from "@/db/schema";
import {
  ApiError,
  handleApiError,
  readJsonObject,
  requiredString,
  requireActiveApiUser,
  requireApiUser,
} from "../../_lib/http";
import {
  applyPaidProductCheckoutSession,
  type ProductCheckoutSession,
} from "../checkout-service";

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
    const effective = await getEffectiveStripeSecrets(db);
    if (!effective.secretKey) {
      throw new ApiError(
        503,
        "payment_not_configured",
        "Store payment is not configured.",
      );
    }
    const session = await stripeRequest<ProductCheckoutSession>(
      { secretKey: effective.secretKey },
      `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    );
    const orderId = session.metadata?.order_id;
    if (!orderId) throw new ApiError(404, "not_found", "Order checkout not found.");
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order || order.userId !== user.userId) {
      throw new ApiError(404, "not_found", "Order checkout not found.");
    }
    const updated = await applyPaidProductCheckoutSession(db, session);
    const items = await db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, [orderId]));
    return Response.json({
      paid: session.payment_status === "paid",
      paymentStatus: session.payment_status ?? "unknown",
      order: { ...(updated ?? order), items },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
