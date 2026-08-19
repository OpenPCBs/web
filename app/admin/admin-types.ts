export type ProductStatus = "draft" | "published" | "archived";
export type StockStatus = "in_stock" | "backorder" | "out_of_stock" | "discontinued";

export type AdminProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  category: string;
  priceCents: number;
  currency: string;
  stockStatus: StockStatus;
  stockQuantity?: number | null;
  imageUrl?: string | null;
  imageR2Key?: string | null;
  imageUrls?: string[] | null;
  sourceUrl?: string | null;
  featured: boolean;
  status: ProductStatus;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  fullName?: string | null;
  role: "customer" | "staff" | "admin";
  status: "active" | "suspended";
  createdAt?: string;
  updatedAt?: string;
};

export type AdminOrderItem = {
  id?: string;
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type AdminOrder = {
  id: string;
  userId: string;
  status: "pending" | "paid" | "payment_failed" | "processing" | "shipped" | "completed" | "cancelled" | "refunded";
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  trackingNumber?: string | null;
  note?: string | null;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  paidAt?: string | null;
  user?: Pick<AdminUser, "id" | "email" | "displayName" | "fullName"> | null;
  items?: AdminOrderItem[];
};

export type VerificationStatus =
  | "quoted"
  | "payment_pending"
  | "paid"
  | "in_review"
  | "verified"
  | "failed"
  | "cancelled";

export type AdminVerification = {
  id: string;
  userId: string;
  designId: string;
  revisionId: string;
  status: VerificationStatus;
  serviceLevel: "release_review" | "bench_reproduction" | "custom_campaign";
  notes: string;
  amountCents: number;
  currency: string;
  createdAt?: string;
  updatedAt?: string;
  paidAt?: string | null;
  completedAt?: string | null;
  badgeExpiresAt?: string | null;
  user?: Pick<AdminUser, "id" | "email" | "displayName" | "fullName"> | null;
  design?: { id: string; title: string; slug?: string } | null;
  revision?: { id: string; version: string; verificationStatus?: string } | null;
};

export type InquiryStatus = "new" | "in_progress" | "resolved" | "closed";

export type AdminInquiry = {
  id: string;
  type: "support" | "quote" | "sourcing" | "license";
  message: string;
  name: string;
  email: string;
  company?: string | null;
  phone?: string | null;
  status: InquiryStatus;
  adminNotes?: string | null;
  assignedToUserId?: string | null;
  productId?: string | null;
  designId?: string | null;
  revisionId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string | null;
};

export type StripeSettings = {
  secretKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  secretKeySource?: string | null;
  webhookSecretSource?: string | null;
  secretKeyLast4?: string | null;
  webhookSecretLast4?: string | null;
  checkoutReady: boolean;
  webhookReady?: boolean;
  originConfigured?: boolean;
  encryptionKeyConfigured?: boolean;
  webhookEndpointId?: string | null;
  webhookEndpointUrl?: string | null;
  lastTestedAt?: string | null;
  lastTestStatus?: string | null;
  lastTestMessage?: string | null;
};

export type StoreSettings = {
  storeName: string;
  supportEmail: string;
  currency: string;
  publicOrigin: string | null;
  checkoutEnabled: boolean;
  allowedShippingCountries: string[];
  flatShippingCents: number;
  automaticTaxEnabled: boolean;
};
