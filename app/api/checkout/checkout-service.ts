import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { cartItems, orderItems, orders, products } from "@/db/schema";
import { ApiError } from "@/app/api/_lib/http";

export type ProductCheckoutSession = {
  id: string;
  url?: string | null;
  status?: string;
  payment_status?: string;
  payment_intent?: string | { id?: string } | null;
  amount_subtotal?: number | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: Record<string, string>;
  customer_details?: {
    name?: string | null;
    email?: string | null;
    address?: unknown;
  } | null;
  shipping_details?: {
    name?: string | null;
    address?: unknown;
  } | null;
  total_details?: {
    amount_tax?: number | null;
    amount_shipping?: number | null;
  } | null;
};

export async function applyPaidProductCheckoutSession(
  db: Database,
  session: ProductCheckoutSession,
) {
  const orderId = session.metadata?.order_id;
  if (!orderId || session.payment_status !== "paid") return null;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  if (order.checkoutSessionId && order.checkoutSessionId !== session.id) {
    throw new ApiError(409, "session_mismatch", "Checkout session does not match the order.");
  }
  const currency = session.currency?.toLowerCase();
  const shippingCents = session.total_details?.amount_shipping ?? order.shippingCents;
  const taxCents = session.total_details?.amount_tax ?? order.taxCents;
  const subtotalCents =
    session.amount_subtotal ??
    (session.amount_total == null
      ? null
      : session.amount_total - shippingCents - taxCents);
  const expectedTotal = order.subtotalCents + shippingCents + taxCents;
  if (
    subtotalCents !== order.subtotalCents ||
    session.amount_total !== expectedTotal ||
    currency !== order.currency.toLowerCase()
  ) {
    throw new ApiError(
      409,
      "amount_mismatch",
      "Stripe checkout totals do not match the server-priced order.",
    );
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const alreadyPaid = [
    "paid",
    "processing",
    "shipped",
    "completed",
    "refunded",
  ].includes(order.status);
  if (alreadyPaid) return order;
  if (!["pending", "payment_failed"].includes(order.status)) {
    throw new ApiError(
      409,
      "order_not_payable",
      "This order is no longer eligible for payment reconciliation.",
    );
  }

  const now = new Date().toISOString();
  const address = session.shipping_details ?? session.customer_details ?? null;
  const claimed = await db
    .update(orders)
    .set({
      status: "paid",
      checkoutSessionId: session.id,
      paymentIntentId,
      shippingCents,
      taxCents,
      totalCents: session.amount_total,
      shippingAddressJson: address
        ? JSON.stringify(address).slice(0, 8_000)
        : order.shippingAddressJson,
      paidAt: order.paidAt ?? now,
      updatedAt: now,
    })
    .where(
      and(
        eq(orders.id, order.id),
        inArray(orders.status, ["pending", "payment_failed"]),
      ),
    )
    .returning({ id: orders.id });
  if (claimed.length) {
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    for (const item of items) {
      if (!item.productId) continue;
      const [product] = await db
        .select({ stockStatus: products.stockStatus })
        .from(products)
        .where(eq(products.id, item.productId))
        .limit(1);
      if (product?.stockStatus !== "in_stock") continue;
      await db
        .update(products)
        .set({
          stockQuantity: sql`max(${products.stockQuantity} - ${item.quantity}, 0)`,
          stockStatus: sql`case when ${products.stockQuantity} - ${item.quantity} <= 0 then 'out_of_stock' else ${products.stockStatus} end`,
          updatedAt: now,
        })
        .where(eq(products.id, item.productId));
    }
    const productIds = items
      .map((item) => item.productId)
      .filter((id): id is string => Boolean(id));
    if (productIds.length) {
      await db
        .delete(cartItems)
        .where(
          and(
            eq(cartItems.userId, order.userId),
            inArray(cartItems.productId, productIds),
          ),
        );
    }
  }
  const [updated] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, order.id))
    .limit(1);
  return updated;
}

export async function applyFailedProductCheckoutSession(
  db: Database,
  session: ProductCheckoutSession,
) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return null;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  if (order.checkoutSessionId && order.checkoutSessionId !== session.id) {
    throw new ApiError(409, "session_mismatch", "Checkout session does not match the order.");
  }
  if (order.status === "pending") {
    await db
      .update(orders)
      .set({ status: "payment_failed", updatedAt: new Date().toISOString() })
      .where(and(eq(orders.id, order.id), eq(orders.status, "pending")));
  }
  const [updated] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
  return updated;
}
