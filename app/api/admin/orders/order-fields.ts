import type { Database } from "@/db";
import { inArray } from "drizzle-orm";
import { orderItems } from "@/db/schema";

export async function attachOrderItems<
  T extends { order: { id: string; adminNote: string | null }; user: unknown },
>(db: Database, rows: T[]) {
  const ids = rows.map(({ order }) => order.id);
  const items = ids.length
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids))
    : [];
  const byOrder = new Map<string, typeof items>();
  for (const item of items) {
    const collection = byOrder.get(item.orderId) ?? [];
    collection.push(item);
    byOrder.set(item.orderId, collection);
  }
  return rows.map(({ order, user }) => ({
    ...order,
    note: order.adminNote,
    user,
    items: byOrder.get(order.id) ?? [],
  }));
}
