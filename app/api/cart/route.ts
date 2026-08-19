import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cartItems, products } from "@/db/schema";
import {
  ApiError,
  handleApiError,
  persistUser,
  positiveInteger,
  readJsonObject,
  requiredString,
  requireActiveApiUser,
  requireApiUser,
} from "../_lib/http";
import { serializePublicProduct } from "../products/public-product";

export async function GET(request: Request) {
  try {
    const user = requireApiUser(request);
    const db = getDb();
    await persistUser(db, user);
    const rows = await db
      .select({ item: cartItems, product: products })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.userId, user.userId))
      .orderBy(desc(cartItems.updatedAt));
    const subtotalCents = rows.reduce(
      (sum, row) => sum + row.item.quantity * row.product.priceCents,
      0,
    );
    return Response.json({
      items: rows.map(({ item, product }) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: product.priceCents,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        product: serializePublicProduct(product),
      })),
      subtotalCents,
      currency: rows[0]?.product.currency ?? "usd",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = requireApiUser(request);
    const body = await readJsonObject(request);
    const productId = requiredString(body.productId, "productId", 100);
    const quantity = positiveInteger(body.quantity ?? 1, "quantity", 25);
    const db = getDb();
    await persistUser(db, user);

    const productRows = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, productId),
          eq(products.active, true),
          eq(products.status, "published"),
        ),
      )
      .limit(1);
    const product = productRows[0];
    if (!product || ["out_of_stock", "discontinued"].includes(product.stockStatus)) {
      throw new ApiError(404, "not_found", "Product is not available.");
    }
    if (product.stockStatus === "in_stock" && quantity > product.stockQuantity) {
      throw new ApiError(
        409,
        "insufficient_stock",
        `Only ${product.stockQuantity} unit${product.stockQuantity === 1 ? " is" : "s are"} available.`,
      );
    }

    const now = new Date().toISOString();
    const itemId = crypto.randomUUID();
    await db
      .insert(cartItems)
      .values({
        id: itemId,
        userId: user.userId,
        productId: product.id,
        quantity,
        unitPriceCents: product.priceCents,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [cartItems.userId, cartItems.productId],
        set: { quantity, unitPriceCents: product.priceCents, updatedAt: now },
      });

    const [item] = await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.userId, user.userId),
          eq(cartItems.productId, product.id),
        ),
      )
      .limit(1);
    return Response.json({
      item: {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: product.priceCents,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        product: serializePublicProduct(product),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDb();
    const user = await requireActiveApiUser(request, db);
    const productId = new URL(request.url).searchParams.get("productId")?.trim();
    if (!productId) {
      throw new ApiError(400, "invalid_field", "productId is required.");
    }
    await db
      .delete(cartItems)
      .where(
        and(eq(cartItems.userId, user.userId), eq(cartItems.productId, productId)),
      );
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
