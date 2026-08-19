export type ProductStockStatus =
  | "in_stock"
  | "backorder"
  | "out_of_stock"
  | "discontinued";

export type ProductRecord = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  currency: string;
  stockStatus: ProductStockStatus;
  imageUrl: string | null;
  featured: boolean;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CartItemRecord = {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  unitPriceCents: number;
  createdAt?: string;
  updatedAt?: string;
  product: ProductRecord;
};

export type ApiErrorPayload = {
  error?: { code?: string; message?: string };
};

const STOCK_STATUSES: readonly ProductStockStatus[] = [
  "in_stock",
  "backorder",
  "out_of_stock",
  "discontinued",
];

export function isProductRecord(value: unknown): value is ProductRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const product = value as Record<string, unknown>;
  return (
    typeof product.id === "string" &&
    typeof product.slug === "string" &&
    typeof product.sku === "string" &&
    typeof product.name === "string" &&
    typeof product.description === "string" &&
    typeof product.category === "string" &&
    typeof product.priceCents === "number" &&
    Number.isFinite(product.priceCents) &&
    typeof product.currency === "string" &&
    typeof product.stockStatus === "string" &&
    (STOCK_STATUSES as readonly string[]).includes(product.stockStatus) &&
    (product.imageUrl === null || typeof product.imageUrl === "string") &&
    typeof product.featured === "boolean"
  );
}

export function publicProductsFromPayload(payload: unknown): ProductRecord[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const records = (payload as { products?: unknown }).products;
  if (!Array.isArray(records)) return [];
  return records.filter(isProductRecord);
}

export function apiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return fallback;
  const error = (payload as ApiErrorPayload).error;
  return typeof error?.message === "string" && error.message.trim()
    ? error.message
    : fallback;
}

export function formatCurrency(cents: number, currency = "usd"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export function stockLabel(status: ProductStockStatus): string {
  if (status === "in_stock") return "In stock";
  if (status === "backorder") return "Backorder";
  if (status === "out_of_stock") return "Out of stock";
  return "Discontinued";
}
