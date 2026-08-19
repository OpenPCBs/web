import { products } from "@/db/schema";

export function serializePublicProduct(product: typeof products.$inferSelect) {
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    description: product.description,
    category: product.category,
    priceCents: product.priceCents,
    currency: product.currency,
    stockStatus: product.stockStatus,
    stockQuantity: product.stockQuantity,
    imageUrl: product.imageR2Key
      ? `/api/products/${encodeURIComponent(product.id)}/image`
      : product.imageUrl,
    imageUrls: parseImageUrls(product.imageUrlsJson),
    featured: product.featured,
  };
}

function parseImageUrls(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
