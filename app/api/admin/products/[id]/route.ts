import { eq } from "drizzle-orm";
import { requireAdminRequest } from "@/app/admin-auth";
import { readJsonObject } from "@/app/api/_lib/http";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { ApiError, adminError, auditAdminAction } from "../../_lib/admin-api";
import { productPatchValues, serializeProduct } from "../product-fields";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requireAdminRequest(request);
    const { id } = await context.params;
    const [product] = await getDb().select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) throw new ApiError(404, "not_found", "Product not found.");
    return Response.json({ product: serializeProduct(product) });
  } catch (error) {
    return adminError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const admin = await requireAdminRequest(request);
    const { id } = await context.params;
    const db = getDb();
    const [current] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!current) throw new ApiError(404, "not_found", "Product not found.");
    const patch = productPatchValues(await readJsonObject(request), current);
    try {
      await db.update(products).set(patch).where(eq(products.id, id));
    } catch (error) {
      if (error instanceof Error && /unique/i.test(`${error.message} ${String(error.cause)}`)) {
        throw new ApiError(409, "product_conflict", "A product already uses that slug or SKU.");
      }
      throw error;
    }
    const [updated] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    await auditAdminAction(db, {
      actorUserId: admin.userId,
      action: "product.updated",
      entityType: "product",
      entityId: id,
      before: current,
      after: updated,
    });
    return Response.json({ product: serializeProduct(updated) });
  } catch (error) {
    return adminError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const admin = await requireAdminRequest(request);
    const { id } = await context.params;
    const db = getDb();
    const [current] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!current) throw new ApiError(404, "not_found", "Product not found.");
    const now = new Date().toISOString();
    await db
      .update(products)
      .set({ status: "archived", active: false, archivedAt: now, updatedAt: now })
      .where(eq(products.id, id));
    const [updated] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    await auditAdminAction(db, {
      actorUserId: admin.userId,
      action: "product.archived",
      entityType: "product",
      entityId: id,
      before: current,
      after: updated,
    });
    return Response.json({ product: serializeProduct(updated) });
  } catch (error) {
    return adminError(error);
  }
}
