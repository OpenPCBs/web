import { and, desc, eq, like, or } from "drizzle-orm";
import { requireAdminRequest } from "@/app/admin-auth";
import { readJsonObject, slugify } from "@/app/api/_lib/http";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import {
  ApiError,
  adminBoolean,
  adminError,
  adminInteger,
  adminString,
  auditAdminAction,
  enumValue,
  parseLimit,
} from "../_lib/admin-api";
import { productValues, serializeProduct } from "./product-fields";

export async function GET(request: Request) {
  try {
    await requireAdminRequest(request);
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim().slice(0, 100);
    const status = enumValue(url.searchParams.get("status") ?? undefined, "status", [
      "draft",
      "published",
      "archived",
    ] as const);
    const conditions = [];
    if (query) {
      conditions.push(
        or(
          like(products.name, `%${query}%`),
          like(products.sku, `%${query}%`),
          like(products.slug, `%${query}%`),
        )!,
      );
    }
    if (status) conditions.push(eq(products.status, status));
    const rows = await getDb()
      .select()
      .from(products)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(products.updatedAt))
      .limit(parseLimit(url));
    return Response.json({ products: rows.map(serializeProduct) });
  } catch (error) {
    return adminError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminRequest(request);
    const body = await readJsonObject(request);
    const name = adminString(body.name, "name", 180, true)!;
    const sku = adminString(body.sku, "sku", 100, true)!;
    const status = enumValue(body.status, "status", ["draft", "published", "archived"] as const) ?? "draft";
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const values = productValues(body, {
      name,
      sku,
      slug: slugify(adminString(body.slug, "slug", 100) ?? name),
      status,
      now,
    });
    const db = getDb();
    try {
      await db.insert(products).values({ id, ...values });
    } catch (error) {
      if (error instanceof Error && /unique/i.test(`${error.message} ${String(error.cause)}`)) {
        throw new ApiError(409, "product_conflict", "A product already uses that slug or SKU.");
      }
      throw error;
    }
    const [created] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    await auditAdminAction(db, {
      actorUserId: admin.userId,
      action: "product.created",
      entityType: "product",
      entityId: id,
      after: created,
    });
    return Response.json({ product: serializeProduct(created) }, { status: 201 });
  } catch (error) {
    return adminError(error);
  }
}
