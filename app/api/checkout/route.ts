import { eq } from "drizzle-orm";
import {
  getAppOrigin,
  getEffectiveStripeSecrets,
  getStoreConfiguration,
} from "@/app/admin-settings";
import { stripeRequest } from "@/app/api/_lib/verification";
import { getDb } from "@/db";
import { cartItems, orderItems, orders, products } from "@/db/schema";
import {
  ApiError,
  handleApiError,
  persistUser,
  requireApiUser,
} from "../_lib/http";
import type { ProductCheckoutSession } from "./checkout-service";

export async function POST(request: Request) {
  try {
    const user = requireApiUser(request);
    const db = getDb();
    await persistUser(db, user);
    const [store, effective, origin] = await Promise.all([
      getStoreConfiguration(db),
      getEffectiveStripeSecrets(db),
      getAppOrigin(db),
    ]);
    if (!store.checkoutEnabled) {
      throw new ApiError(503, "checkout_disabled", "Store checkout is currently disabled.");
    }
    if (!effective.secretKey || !origin) {
      throw new ApiError(
        503,
        "payment_not_configured",
        "Store payment is not fully configured.",
      );
    }

    const rows = await db
      .select({ item: cartItems, product: products })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.userId, user.userId));
    if (!rows.length) {
      throw new ApiError(409, "empty_cart", "Add a product before starting checkout.");
    }
    for (const { item, product } of rows) {
      if (
        !product.active ||
        product.status !== "published" ||
        ["out_of_stock", "discontinued"].includes(product.stockStatus)
      ) {
        throw new ApiError(
          409,
          "product_unavailable",
          `${product.name} is no longer available. Remove it from your cart.`,
        );
      }
      if (
        product.stockStatus === "in_stock" &&
        item.quantity > product.stockQuantity
      ) {
        throw new ApiError(
          409,
          "insufficient_stock",
          `${product.name} has only ${product.stockQuantity} available.`,
        );
      }
    }
    const currencies = new Set(rows.map(({ product }) => product.currency.toLowerCase()));
    if (currencies.size !== 1 || !currencies.has(store.currency.toLowerCase())) {
      throw new ApiError(
        409,
        "mixed_currency",
        "Every cart item must use the store currency.",
      );
    }
    const subtotalCents = rows.reduce(
      (sum, { item, product }) => sum + item.quantity * product.priceCents,
      0,
    );
    if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 1) {
      throw new ApiError(409, "invalid_total", "The cart total is invalid.");
    }
    const shippingCents = store.flatShippingCents;
    const orderId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(orders).values({
      id: orderId,
      userId: user.userId,
      subtotalCents,
      shippingCents,
      taxCents: 0,
      totalCents: subtotalCents + shippingCents,
      currency: store.currency.toLowerCase(),
      paymentProvider: "stripe",
      updatedAt: now,
    });
    try {
      await db.insert(orderItems).values(
        rows.map(({ item, product }) => ({
          id: crypto.randomUUID(),
          orderId,
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: item.quantity,
          unitPriceCents: product.priceCents,
          lineTotalCents: item.quantity * product.priceCents,
        })),
      );
    } catch (error) {
      await db.delete(orders).where(eq(orders.id, orderId));
      throw error;
    }

    try {
      const form = checkoutForm({
        orderId,
        userEmail: user.email,
        origin,
        currency: store.currency.toLowerCase(),
        shippingCents,
        automaticTaxEnabled: store.automaticTaxEnabled,
        allowedCountries: safeShippingCountries(store.allowedShippingCountriesJson),
        rows,
      });
      const session = await stripeRequest<ProductCheckoutSession>(
        { secretKey: effective.secretKey },
        "/v1/checkout/sessions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Idempotency-Key": `product-order-${orderId}`,
          },
          body: form,
        },
      );
      if (!session.id || !session.url) {
        throw new ApiError(
          502,
          "payment_provider_error",
          "Stripe did not return a hosted checkout URL.",
        );
      }
      await db
        .update(orders)
        .set({ checkoutSessionId: session.id, updatedAt: new Date().toISOString() })
        .where(eq(orders.id, orderId));
      return Response.json({ url: session.url, sessionId: session.id, orderId });
    } catch (error) {
      await db
        .update(orders)
        .set({ status: "payment_failed", updatedAt: new Date().toISOString() })
        .where(eq(orders.id, orderId));
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

function checkoutForm(input: {
  orderId: string;
  userEmail: string;
  origin: string;
  currency: string;
  shippingCents: number;
  automaticTaxEnabled: boolean;
  allowedCountries: string[];
  rows: Array<{
    item: typeof cartItems.$inferSelect;
    product: typeof products.$inferSelect;
  }>;
}) {
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set(
    "success_url",
    `${input.origin}/account?checkout=order&session_id={CHECKOUT_SESSION_ID}`,
  );
  form.set("cancel_url", `${input.origin}/cart?checkout=cancelled`);
  form.set("customer_email", input.userEmail);
  form.set("client_reference_id", input.orderId);
  form.set("metadata[order_id]", input.orderId);
  form.set("payment_intent_data[metadata][order_id]", input.orderId);
  form.set("automatic_tax[enabled]", input.automaticTaxEnabled ? "true" : "false");
  input.allowedCountries.forEach((country) =>
    form.append("shipping_address_collection[allowed_countries][]", country),
  );
  form.set(
    "shipping_options[0][shipping_rate_data][type]",
    "fixed_amount",
  );
  form.set(
    "shipping_options[0][shipping_rate_data][fixed_amount][amount]",
    String(input.shippingCents),
  );
  form.set(
    "shipping_options[0][shipping_rate_data][fixed_amount][currency]",
    input.currency,
  );
  form.set(
    "shipping_options[0][shipping_rate_data][display_name]",
    "Standard shipping",
  );
  input.rows.forEach(({ item, product }, index) => {
    form.set(`line_items[${index}][price_data][currency]`, input.currency);
    form.set(
      `line_items[${index}][price_data][unit_amount]`,
      String(product.priceCents),
    );
    form.set(
      `line_items[${index}][price_data][product_data][name]`,
      product.name,
    );
    form.set(
      `line_items[${index}][price_data][product_data][description]`,
      `${product.sku} · ${product.description}`.slice(0, 500),
    );
    form.set(`line_items[${index}][quantity]`, String(item.quantity));
  });
  return form;
}

function safeShippingCountries(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length &&
      parsed.every((country) => typeof country === "string" && /^[A-Z]{2}$/.test(country))
    ) {
      return parsed;
    }
  } catch {
    // Use the safe default.
  }
  return ["US"];
}
