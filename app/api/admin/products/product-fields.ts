import { products } from "@/db/schema";
import {
  ApiError,
  adminBoolean,
  adminInteger,
  adminString,
  enumValue,
} from "../_lib/admin-api";

type ProductStatus = (typeof products.$inferInsert)["status"];

export function productValues(
  body: Record<string, unknown>,
  base: {
    name: string;
    sku: string;
    slug: string;
    status: ProductStatus;
    now: string;
  },
): Omit<typeof products.$inferInsert, "id"> {
  const currency = (adminString(body.currency, "currency", 3) ?? "usd").toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) {
    throw new ApiError(400, "invalid_field", "currency must be a three-letter code.");
  }
  const imageUrls = imageUrlList(body.imageUrls);
  const imageUrl = optionalHttpUrl(body.imageUrl, "imageUrl");
  const sourceUrl = optionalHttpUrl(body.sourceUrl, "sourceUrl");
  const priceCents = adminInteger(body.priceCents, "priceCents", 0, 100_000_000) ?? 0;
  const stockStatus =
    enumValue(body.stockStatus, "stockStatus", [
      "in_stock",
      "backorder",
      "out_of_stock",
      "discontinued",
    ] as const) ?? "in_stock";
  const stockQuantity =
    adminInteger(body.stockQuantity, "stockQuantity", 0, 10_000_000) ?? 0;
  assertPublishable(base.status, priceCents, stockStatus, stockQuantity);
  return {
    name: base.name,
    sku: base.sku,
    slug: base.slug,
    description: adminString(body.description, "description", 20_000) ?? "",
    category: adminString(body.category, "category", 100) ?? "Other",
    priceCents,
    currency,
    stockStatus,
    stockQuantity,
    imageUrl,
    imageUrlsJson: JSON.stringify(imageUrls),
    sourceUrl,
    featured: adminBoolean(body.featured, "featured") ?? false,
    active: base.status === "published",
    status: base.status,
    updatedAt: base.now,
    publishedAt: base.status === "published" ? base.now : null,
    archivedAt: base.status === "archived" ? base.now : null,
  };
}

export function productPatchValues(
  body: Record<string, unknown>,
  current: typeof products.$inferSelect,
) {
  const now = new Date().toISOString();
  const status =
    enumValue(body.status, "status", ["draft", "published", "archived"] as const) ??
    current.status;
  const currency = adminString(body.currency, "currency", 3)?.toLowerCase();
  if (currency && !/^[a-z]{3}$/.test(currency)) {
    throw new ApiError(400, "invalid_field", "currency must be a three-letter code.");
  }
  const priceCents =
    body.priceCents !== undefined
      ? adminInteger(body.priceCents, "priceCents", 0, 100_000_000)!
      : current.priceCents;
  const stockStatus =
    body.stockStatus !== undefined
      ? enumValue(body.stockStatus, "stockStatus", [
          "in_stock",
          "backorder",
          "out_of_stock",
          "discontinued",
        ] as const)!
      : current.stockStatus;
  const stockQuantity =
    body.stockQuantity !== undefined
      ? adminInteger(body.stockQuantity, "stockQuantity", 0, 10_000_000)!
      : current.stockQuantity;
  assertPublishable(status, priceCents, stockStatus, stockQuantity);
  return {
    ...(body.name !== undefined ? { name: adminString(body.name, "name", 180, true)! } : {}),
    ...(body.slug !== undefined ? { slug: adminString(body.slug, "slug", 100, true)!.toLowerCase() } : {}),
    ...(body.sku !== undefined ? { sku: adminString(body.sku, "sku", 100, true)! } : {}),
    ...(body.description !== undefined ? { description: adminString(body.description, "description", 20_000) ?? "" } : {}),
    ...(body.category !== undefined ? { category: adminString(body.category, "category", 100) ?? "Other" } : {}),
    ...(body.priceCents !== undefined ? { priceCents } : {}),
    ...(currency ? { currency } : {}),
    ...(body.stockStatus !== undefined
      ? {
          stockStatus,
        }
      : {}),
    ...(body.stockQuantity !== undefined ? { stockQuantity } : {}),
    ...(body.imageUrl !== undefined ? { imageUrl: optionalHttpUrl(body.imageUrl, "imageUrl") } : {}),
    ...(body.imageUrls !== undefined ? { imageUrlsJson: JSON.stringify(imageUrlList(body.imageUrls)) } : {}),
    ...(body.sourceUrl !== undefined ? { sourceUrl: optionalHttpUrl(body.sourceUrl, "sourceUrl") } : {}),
    ...(body.featured !== undefined ? { featured: adminBoolean(body.featured, "featured")! } : {}),
    status,
    active: status === "published",
    publishedAt:
      status === "published" ? current.publishedAt ?? now : current.publishedAt,
    archivedAt: status === "archived" ? current.archivedAt ?? now : null,
    updatedAt: now,
  };
}

export function serializeProduct(product: typeof products.$inferSelect) {
  let imageUrls: string[] = [];
  try {
    const parsed = JSON.parse(product.imageUrlsJson) as unknown;
    if (Array.isArray(parsed)) imageUrls = parsed.filter((item): item is string => typeof item === "string");
  } catch {
    imageUrls = [];
  }
  return {
    ...product,
    imageUrl: product.imageR2Key ? `/api/products/${product.id}/image` : product.imageUrl,
    imageUrls,
  };
}

function imageUrlList(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8) {
    throw new ApiError(400, "invalid_field", "imageUrls must contain at most 8 URLs.");
  }
  return value.map((item) => optionalHttpUrl(item, "imageUrls")!).filter(Boolean);
}

function optionalHttpUrl(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2_000) {
    throw new ApiError(400, "invalid_field", `${field} must be a valid URL.`);
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return url.toString();
  } catch {
    throw new ApiError(400, "invalid_field", `${field} must be an HTTP or HTTPS URL.`);
  }
}

function assertPublishable(
  status: ProductStatus,
  priceCents: number,
  stockStatus: "in_stock" | "backorder" | "out_of_stock" | "discontinued",
  stockQuantity: number,
) {
  if (status !== "published") return;
  if (priceCents < 50) {
    throw new ApiError(
      400,
      "product_not_publishable",
      "Published products must have a price of at least 50 cents.",
    );
  }
  if (stockStatus === "in_stock" && stockQuantity < 1) {
    throw new ApiError(
      400,
      "product_not_publishable",
      "An in-stock published product must have at least one unit in inventory.",
    );
  }
}
