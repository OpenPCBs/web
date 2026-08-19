import { eq } from "drizzle-orm";
import { requireAdminRequest } from "@/app/admin-auth";
import { readJsonObject } from "@/app/api/_lib/http";
import { getDb } from "@/db";
import { orders, users } from "@/db/schema";
import {
  ApiError,
  adminError,
  adminString,
  auditAdminAction,
  enumValue,
} from "../../_lib/admin-api";
import { attachOrderItems } from "../order-fields";

const statuses = [
  "pending",
  "paid",
  "payment_failed",
  "processing",
  "shipped",
  "completed",
  "cancelled",
  "refunded",
] as const;

type OrderStatus = (typeof statuses)[number];

const manualTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["cancelled"],
  paid: ["processing"],
  payment_failed: ["cancelled"],
  processing: ["shipped", "completed"],
  shipped: ["completed"],
  completed: [],
  cancelled: [],
  refunded: [],
};

const stripeOwnedStatuses = new Set<OrderStatus>([
  "pending",
  "paid",
  "payment_failed",
  "refunded",
]);

type Context = { params: Promise<{ id: string }> | { id: string } };

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireAdminRequest(request);
    const { id } = await context.params;
    const body = await readJsonObject(request);
    const status = enumValue(body.status, "status", statuses);
    const note = adminString(body.note ?? body.adminNote, "note", 5_000);
    const trackingNumber = adminString(body.trackingNumber, "trackingNumber", 200);
    if (status === undefined && note === undefined && trackingNumber === undefined) {
      throw new ApiError(400, "empty_update", "No supported order changes were provided.");
    }
    const db = getDb();
    const [current] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!current) throw new ApiError(404, "not_found", "Order not found.");
    if (status !== undefined && status !== current.status) {
      if (stripeOwnedStatuses.has(status)) {
        throw new ApiError(
          409,
          "payment_status_managed_by_stripe",
          `${status} is controlled by Stripe and cannot be set manually.`,
        );
      }
      if (!manualTransitions[current.status].includes(status)) {
        throw new ApiError(
          409,
          "invalid_order_transition",
          `Order status cannot change from ${current.status} to ${status}.`,
        );
      }
    }

    await db
      .update(orders)
      .set({
        ...(status === undefined || status === current.status ? {} : { status }),
        ...(note === undefined ? {} : { adminNote: note }),
        ...(trackingNumber === undefined ? {} : { trackingNumber }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orders.id, id));
    const [row] = await db
      .select({
        order: orders,
        user: {
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          fullName: users.fullName,
        },
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(eq(orders.id, id))
      .limit(1);
    const [updated] = await attachOrderItems(db, row ? [row] : []);
    await auditAdminAction(db, {
      actorUserId: actor.userId,
      action: "order.updated",
      entityType: "order",
      entityId: id,
      before: current,
      after: updated,
    });
    return Response.json({ order: updated });
  } catch (error) {
    return adminError(error);
  }
}
