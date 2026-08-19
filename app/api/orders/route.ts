import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { cartItems, orderItems, orders, products } from "@/db/schema";
import {
  ApiError,
  handleApiError,
  persistUser,
  readJsonObject,
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
    const user = requireApiUser(request);
    const body = await readJsonObject(request);
    const shippingAddress = body.shippingAddress;
    if (
      shippingAddress !== undefined &&
      (!shippingAddress || typeof shippingAddress !== "object" || Array.isArray(shippingAddress))
    ) {
      throw new ApiError(400, "invalid_field", "shippingAddress must be an object.");
    }
    const shippingAddressJson = shippingAddress
      ? JSON.stringify(shippingAddress).slice(0, 8_000)
      : null;
    const db = getDb();
    await persistUser(db, user);
    const cartRows = await db
      .select({ item: cartItems, product: products })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.userId, user.userId));
    if (!cartRows.length) {
      throw new ApiError(409, "empty_cart", "Add a product before creating an order.");
    }
    const currencies = new Set(cartRows.map((row) => row.product.currency));
    if (currencies.size !== 1) {
      throw new ApiError(409, "mixed_currency", "Cart products must use one currency.");
    }

    const subtotalCents = cartRows.reduce(
      (sum, row) => sum + row.item.quantity * row.item.unitPriceCents,
      0,
    );
    const orderId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(orders).values({
      id: orderId,
      userId: user.userId,
      subtotalCents,
      totalCents: subtotalCents,
      currency: cartRows[0].product.currency,
      shippingAddressJson,
      updatedAt: now,
    });
    try {
      await db.insert(orderItems).values(
        cartRows.map(({ item, product }) => ({
          id: crypto.randomUUID(),
          orderId,
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          lineTotalCents: item.quantity * item.unitPriceCents,
        })),
      );
      await db.delete(cartItems).where(eq(cartItems.userId, user.userId));
    } catch (error) {
      await db.delete(orders).where(eq(orders.id, orderId));
      throw error;
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
    return Response.json({ order: { ...order, items } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
