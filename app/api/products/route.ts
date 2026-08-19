import { and, desc, eq, like, or } from "drizzle-orm";
import { getOptionalDb } from "@/db";
import { seededProducts } from "@/db/catalog";
import { products } from "@/db/schema";
import { handleApiError, isMissingStorageError } from "../_lib/http";

function filterSeeds(url: URL) {
  const query = url.searchParams.get("q")?.trim().toLowerCase();
  const category = url.searchParams.get("category")?.trim().toLowerCase();
  return seededProducts.filter((product) => {
    const matchesQuery =
      !query ||
      product.name.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query);
    const matchesCategory = !category || product.category.toLowerCase() === category;
    return matchesQuery && matchesCategory;
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const db = getOptionalDb();
  if (!db) return Response.json({ products: filterSeeds(url), source: "seed" });
  try {
    const query = url.searchParams.get("q")?.trim().slice(0, 100);
    const category = url.searchParams.get("category")?.trim().slice(0, 80);
    const conditions = [eq(products.active, true)];
    if (query) {
      conditions.push(
        or(like(products.name, `%${query}%`), like(products.description, `%${query}%`))!,
      );
    }
    if (category) conditions.push(eq(products.category, category));

    const rows = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(desc(products.featured), desc(products.updatedAt))
      .limit(100);
    return Response.json({
      products: rows.length ? rows : filterSeeds(url),
      source: rows.length ? "database" : "seed",
    });
  } catch (error) {
    if (isMissingStorageError(error)) {
      return Response.json({ products: filterSeeds(url), source: "seed" });
    }
    return handleApiError(error);
  }
}
