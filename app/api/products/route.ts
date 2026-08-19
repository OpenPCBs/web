import { and, desc, eq, like, or } from "drizzle-orm";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { handleApiError } from "../_lib/http";
import { serializePublicProduct } from "./public-product";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const query = url.searchParams.get("q")?.trim().slice(0, 100);
    const category = url.searchParams.get("category")?.trim().slice(0, 80);
    const conditions = [
      eq(products.active, true),
      eq(products.status, "published"),
    ];
    if (query) {
      conditions.push(
        or(
          like(products.name, `%${query}%`),
          like(products.description, `%${query}%`),
          like(products.sku, `%${query}%`),
          like(products.category, `%${query}%`),
        )!,
      );
    }
    if (category) conditions.push(eq(products.category, category));

    const rows = await getDb()
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(desc(products.featured), desc(products.updatedAt))
      .limit(100);
    return Response.json({
      products: rows.map(serializePublicProduct),
      source: "database",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
