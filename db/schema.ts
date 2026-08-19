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
    imageUrl: text("image_url"),
    sourceUrl: text("source_url"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("products_slug_unique").on(table.slug),
    uniqueIndex("products_sku_unique").on(table.sku),
    index("products_active_idx").on(table.active, table.category),
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
      enum: ["pending", "paid", "processing", "shipped", "completed", "cancelled", "refunded"],
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

export type RevisionVerificationStatus =
  (typeof revisions.$inferSelect)["verificationStatus"];
export type VerificationRequestStatus =
  (typeof verificationRequests.$inferSelect)["status"];
