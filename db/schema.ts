import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamp = (name: string) =>
  text(name).notNull().default(sql`CURRENT_TIMESTAMP`);

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    fullName: text("full_name"),
    role: text("role", { enum: ["customer", "staff", "admin"] })
      .notNull()
      .default("customer"),
    status: text("status", { enum: ["active", "suspended"] })
      .notNull()
      .default("active"),
    lastSeenAt: text("last_seen_at"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const designs = sqliteTable(
  "designs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("Other"),
    license: text("license").notNull().default("CERN-OHL-P-2.0"),
    priceCents: integer("price_cents").notNull().default(0),
    coverImageUrl: text("cover_image_url"),
    publicationStatus: text("publication_status", {
      enum: ["draft", "published", "archived"],
    })
      .notNull()
      .default("draft"),
    currentRevisionId: text("current_revision_id"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    publishedAt: text("published_at"),
  },
  (table) => [
    uniqueIndex("designs_slug_unique").on(table.slug),
    index("designs_owner_idx").on(table.ownerId),
    index("designs_publication_idx").on(table.publicationStatus, table.updatedAt),
  ],
);

export const revisions = sqliteTable(
  "revisions",
  {
    id: text("id").primaryKey(),
    designId: text("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    changelog: text("changelog").notNull().default(""),
    lifecycleStatus: text("lifecycle_status", {
      enum: ["draft", "published", "superseded"],
    })
      .notNull()
      .default("draft"),
    verificationStatus: text("verification_status", {
      enum: [
        "unverified",
        "quoted",
        "payment_pending",
        "paid",
        "in_review",
        "verified",
        "failed",
        "cancelled",
      ],
    })
      .notNull()
      .default("unverified"),
    verifiedAt: text("verified_at"),
    verificationBadgeExpiresAt: text("verification_badge_expires_at"),
    createdAt: timestamp("created_at"),
    publishedAt: text("published_at"),
  },
  (table) => [
    uniqueIndex("revisions_design_version_unique").on(
      table.designId,
      table.version,
    ),
    index("revisions_design_idx").on(table.designId, table.createdAt),
    index("revisions_verification_idx").on(table.verificationStatus),
  ],
);

export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    designId: text("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "cascade" }),
    revisionId: text("revision_id")
      .notNull()
      .references(() => revisions.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    originalName: text("original_name").notNull(),
    mediaType: text("media_type").notNull().default("application/octet-stream"),
    kind: text("kind", {
      enum: [
        "gerber",
        "drill",
        "bom",
        "pick_and_place",
        "schematic",
        "source",
        "firmware",
        "render",
        "archive",
        "other",
      ],
    })
      .notNull()
      .default("other"),
    byteSize: integer("byte_size").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    visibility: text("visibility", { enum: ["private", "public"] })
      .notNull()
      .default("private"),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("files_r2_key_unique").on(table.r2Key),
    index("files_revision_idx").on(table.revisionId, table.createdAt),
    index("files_owner_idx").on(table.ownerId),
  ],
);

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("Other"),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    stockStatus: text("stock_status", {
      enum: ["in_stock", "backorder", "out_of_stock", "discontinued"],
    })
      .notNull()
      .default("in_stock"),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    imageUrl: text("image_url"),
    imageR2Key: text("image_r2_key"),
    imageUrlsJson: text("image_urls_json").notNull().default("[]"),
    sourceUrl: text("source_url"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    status: text("status", { enum: ["draft", "published", "archived"] })
      .notNull()
      .default("draft"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    publishedAt: text("published_at"),
    archivedAt: text("archived_at"),
  },
  (table) => [
    uniqueIndex("products_slug_unique").on(table.slug),
    uniqueIndex("products_sku_unique").on(table.sku),
    index("products_active_idx").on(table.active, table.status, table.category),
  ],
);

export const cartItems = sqliteTable(
  "cart_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("cart_items_user_product_unique").on(
      table.userId,
      table.productId,
    ),
    index("cart_items_user_idx").on(table.userId, table.updatedAt),
  ],
);

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: text("status", {
      enum: ["pending", "paid", "payment_failed", "processing", "shipped", "completed", "cancelled", "refunded"],
    })
      .notNull()
      .default("pending"),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    paymentProvider: text("payment_provider"),
    checkoutSessionId: text("checkout_session_id"),
    paymentIntentId: text("payment_intent_id"),
    shippingAddressJson: text("shipping_address_json"),
    trackingNumber: text("tracking_number"),
    adminNote: text("admin_note"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    paidAt: text("paid_at"),
  },
  (table) => [
    index("orders_user_idx").on(table.userId, table.createdAt),
    uniqueIndex("orders_checkout_session_unique").on(table.checkoutSessionId),
  ],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);

export const verificationRequests = sqliteTable(
  "verification_requests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    designId: text("design_id")
      .notNull()
      .references(() => designs.id, { onDelete: "restrict" }),
    revisionId: text("revision_id")
      .notNull()
      .references(() => revisions.id, { onDelete: "restrict" }),
    status: text("status", {
      enum: [
        "quoted",
        "payment_pending",
        "paid",
        "in_review",
        "verified",
        "failed",
        "cancelled",
      ],
    })
      .notNull()
      .default("quoted"),
    serviceLevel: text("service_level", {
      enum: ["release_review", "bench_reproduction", "custom_campaign"],
    })
      .notNull()
      .default("release_review"),
    notes: text("notes").notNull().default(""),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    paidAt: text("paid_at"),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("verification_requests_user_idx").on(table.userId, table.createdAt),
    index("verification_requests_revision_idx").on(
      table.revisionId,
      table.createdAt,
    ),
    uniqueIndex("verification_requests_stripe_session_unique").on(
      table.stripeCheckoutSessionId,
    ),
  ],
);

export const quotes = sqliteTable(
  "quotes",
  {
    id: text("id").primaryKey(),
    verificationRequestId: text("verification_request_id")
      .notNull()
      .references(() => verificationRequests.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["open", "accepted", "expired", "withdrawn"],
    })
      .notNull()
      .default("open"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    lineItemsJson: text("line_items_json").notNull(),
    validUntil: text("valid_until").notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    acceptedAt: text("accepted_at"),
  },
  (table) => [
    index("quotes_request_idx").on(table.verificationRequestId, table.createdAt),
  ],
);

export const verificationEvents = sqliteTable(
  "verification_events",
  {
    id: text("id").primaryKey(),
    verificationRequestId: text("verification_request_id")
      .notNull()
      .references(() => verificationRequests.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    message: text("message").notNull().default(""),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    index("verification_events_request_idx").on(
      table.verificationRequestId,
      table.createdAt,
    ),
  ],
);

export const storeSettings = sqliteTable("store_settings", {
  id: text("id").primaryKey(),
  storeName: text("store_name").notNull().default("Thevenin Supply"),
  supportEmail: text("support_email").notNull().default(""),
  currency: text("currency").notNull().default("usd"),
  publicOrigin: text("public_origin"),
  allowedShippingCountriesJson: text("allowed_shipping_countries_json")
    .notNull()
    .default('["US"]'),
  flatShippingCents: integer("flat_shipping_cents").notNull().default(0),
  automaticTaxEnabled: integer("automatic_tax_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  checkoutEnabled: integer("checkout_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const stripeSettings = sqliteTable("stripe_settings", {
  id: text("id").primaryKey(),
  secretKeyCiphertext: text("secret_key_ciphertext"),
  secretKeyLast4: text("secret_key_last4"),
  webhookSecretCiphertext: text("webhook_secret_ciphertext"),
  webhookSecretLast4: text("webhook_secret_last4"),
  webhookEndpointId: text("webhook_endpoint_id"),
  webhookEndpointUrl: text("webhook_endpoint_url"),
  lastTestedAt: text("last_tested_at"),
  lastTestStatus: text("last_test_status", {
    enum: ["success", "failed"],
  }),
  lastTestMessage: text("last_test_message"),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const adminAuditEvents = sqliteTable(
  "admin_audit_events",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    index("admin_audit_entity_idx").on(
      table.entityType,
      table.entityId,
      table.createdAt,
    ),
    index("admin_audit_actor_idx").on(table.actorUserId, table.createdAt),
  ],
);

export const inquiries = sqliteTable(
  "inquiries",
  {
    id: text("id").primaryKey(),
    type: text("type", {
      enum: ["support", "quote", "sourcing", "license"],
    }).notNull(),
    status: text("status", {
      enum: ["new", "in_progress", "resolved", "closed"],
    })
      .notNull()
      .default("new"),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    company: text("company"),
    phone: text("phone"),
    subject: text("subject"),
    message: text("message").notNull(),
    context: text("context"),
    productId: text("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    designId: text("design_id").references(() => designs.id, {
      onDelete: "set null",
    }),
    revisionId: text("revision_id").references(() => revisions.id, {
      onDelete: "set null",
    }),
    adminNotes: text("admin_notes").notNull().default(""),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    resolvedAt: text("resolved_at"),
  },
  (table) => [
    index("inquiries_status_idx").on(table.status, table.createdAt),
    index("inquiries_email_idx").on(table.email, table.createdAt),
  ],
);

export type RevisionVerificationStatus =
  (typeof revisions.$inferSelect)["verificationStatus"];
export type VerificationRequestStatus =
  (typeof verificationRequests.$inferSelect)["status"];
