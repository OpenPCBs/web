import { and, desc, eq, like, or } from "drizzle-orm";
import { requireAdminRequest } from "@/app/admin-auth";
import { getDb } from "@/db";
import { orders, users } from "@/db/schema";
import { adminError, enumValue, parseLimit } from "../_lib/admin-api";
import { attachOrderItems } from "./order-fields";

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

export async function GET(request: Request) {
  try {
    await requireAdminRequest(request);
    const url = new URL(request.url);
    const status = enumValue(
      url.searchParams.get("status") ?? undefined,
      "status",
      statuses,
    );
    const query = url.searchParams.get("q")?.trim().slice(0, 160);
    const conditions = [];
    if (status) conditions.push(eq(orders.status, status));
    if (query) {
      conditions.push(
        or(
          like(orders.id, `%${query}%`),
          like(users.email, `%${query}%`),
          like(users.displayName, `%${query}%`),
        )!,
      );
    }
    const db = getDb();
    const rows = await db
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
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(parseLimit(url));
    return Response.json({ orders: await attachOrderItems(db, rows) });
  } catch (error) {
    return adminError(error);
  }
}
