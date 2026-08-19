import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { orderItems, orders } from "@/db/schema";
import {
  handleApiError,
  requireApiUser,
} from "../_lib/http";

export async function GET(request: Request) {
  try {
    const user = requireApiUser(request);
    const db = getDb();
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, user.userId))
      .orderBy(desc(orders.createdAt))
      .limit(50);
    const ids = orderRows.map((order) => order.id);
    const itemRows = ids.length
      ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids))
      : [];
    return Response.json({
      orders: orderRows.map((order) => ({
        ...order,
        items: itemRows.filter((item) => item.orderId === order.id),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    // Order records are created only by the server-priced Stripe checkout flow.
    requireApiUser(request);
    return Response.json(
      {
        error: {
          code: "checkout_required",
          message: "Start payment with POST /api/checkout.",
        },
      },
      { status: 405, headers: { Allow: "GET" } },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
