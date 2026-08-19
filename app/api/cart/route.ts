import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { seededProducts } from "@/db/catalog";
import { cartItems, products } from "@/db/schema";
import {
  ApiError,
  handleApiError,
  persistUser,
  positiveInteger,
  readJsonObject,
  requiredString,
  requireApiUser,
} from "../_lib/http";

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
      (sum, row) => sum + row.item.quantity * row.item.unitPriceCents,
      0,
    );
    return Response.json({
      items: rows.map(({ item, product }) => ({ ...item, product })),
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
      .where(and(eq(products.id, productId), eq(products.active, true)))
      .limit(1);
    let product: typeof products.$inferSelect | undefined = productRows[0];
    if (!product) {
      product = await materializeSeedProduct(db, productId);
    }
    if (!product || ["out_of_stock", "discontinued"].includes(product.stockStatus)) {
      throw new ApiError(404, "not_found", "Product is not available.");
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
    return Response.json({ item: { ...item, product } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = requireApiUser(request);
    const productId = new URL(request.url).searchParams.get("productId")?.trim();
    if (!productId) {
      throw new ApiError(400, "invalid_field", "productId is required.");
    }
    const db = getDb();
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

async function materializeSeedProduct(
  db: ReturnType<typeof getDb>,
  productId: string,
) {
  const seed = seededProducts.find((item) => item.id === productId);
  if (!seed) return undefined;
  await db
    .insert(products)
    .values({
      ...seed,
      active: true,
      sourceUrl: null,
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: products.id });
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  return product;
}
