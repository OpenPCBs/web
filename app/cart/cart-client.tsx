"use client";

import Link from "../components/native-link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  apiErrorMessage,
  formatCurrency,
  isProductRecord,
  stockLabel,
  type CartItemRecord,
} from "@/app/components/catalog-api";
import styles from "./cart.module.css";
import { CART_CHANGED_EVENT } from "@/app/components/cart-indicator";

type CartData = {
  items: CartItemRecord[];
  subtotalCents: number;
  currency: string;
};

type CartState = "idle" | "loading" | "ready" | "error";

function parseCart(payload: unknown): CartData | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as {
    items?: unknown;
    subtotalCents?: unknown;
    currency?: unknown;
  };
  if (
    !Array.isArray(record.items) ||
    typeof record.subtotalCents !== "number" ||
    !Number.isFinite(record.subtotalCents) ||
    typeof record.currency !== "string"
  ) {
    return null;
  }

  const items: CartItemRecord[] = [];
  for (const value of record.items) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    if (
      typeof item.id !== "string" ||
      typeof item.userId !== "string" ||
      typeof item.productId !== "string" ||
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      typeof item.unitPriceCents !== "number" ||
      !Number.isFinite(item.unitPriceCents) ||
      !isProductRecord(item.product)
    ) {
      return null;
    }
    items.push({
      id: item.id,
      userId: item.userId,
      productId: item.productId,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : undefined,
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
      product: item.product,
    });
  }
  return { items, subtotalCents: record.subtotalCents, currency: record.currency };
}

function safeCheckoutUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as { url?: unknown }).url;
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function CartImage({ item }: { item: CartItemRecord }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = item.product.imageUrl?.trim();
  return (
    <div className={styles.thumb}>
      {imageUrl && !failed ? (
        <img src={imageUrl} alt={item.product.name} onError={() => setFailed(true)} />
      ) : (
        <span>Image not provided</span>
      )}
    </div>
  );
}

export function CartClient({
  signedIn,
  displayName,
  signInHref,
  checkoutCancelled,
}: {
  signedIn: boolean;
  displayName: string | null;
  signInHref: string;
  checkoutCancelled: boolean;
}) {
  const [cart, setCart] = useState<CartData | null>(null);
  const [state, setState] = useState<CartState>(signedIn ? "loading" : "idle");
  const [error, setError] = useState("");
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(!signedIn);

  const loadCart = useCallback(async () => {
    if (!signedIn) return;
    setState("loading");
    setError("");
    try {
      const response = await fetch("/api/cart", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401) {
        setNeedsSignIn(true);
        setCart(null);
        setState("idle");
        return;
      }
      if (!response.ok) {
        throw new Error(apiErrorMessage(payload, "Your cart could not be loaded."));
      }
      const parsed = parseCart(payload);
      if (!parsed) throw new Error("The cart service returned an unexpected response.");
      setCart(parsed);
      setNeedsSignIn(false);
      setState("ready");
    } catch (caught) {
      setCart(null);
      setError(caught instanceof Error ? caught.message : "Your cart could not be loaded.");
      setState("error");
    }
  }, [signedIn]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  const itemCount = useMemo(
    () => cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
    [cart],
  );

  async function updateQuantity(item: CartItemRecord, quantity: number) {
    const nextQuantity = Math.max(1, Math.min(25, Math.trunc(quantity)));
    if (nextQuantity === item.quantity || busyProductId) return;
    setBusyProductId(item.productId);
    setError("");
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ productId: item.productId, quantity: nextQuantity }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401) {
        setNeedsSignIn(true);
        return;
      }
      if (!response.ok) {
        throw new Error(apiErrorMessage(payload, "The quantity could not be updated."));
      }
      await loadCart();
      window.dispatchEvent(new Event(CART_CHANGED_EVENT));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The quantity could not be updated.");
    } finally {
      setBusyProductId(null);
    }
  }

  async function removeItem(item: CartItemRecord) {
    if (busyProductId) return;
    setBusyProductId(item.productId);
    setError("");
    try {
      const response = await fetch(
        `/api/cart?productId=${encodeURIComponent(item.productId)}`,
        { method: "DELETE", headers: { Accept: "application/json" } },
      );
      const payload: unknown = response.status === 204
        ? null
        : await response.json().catch(() => null);
      if (response.status === 401) {
        setNeedsSignIn(true);
        return;
      }
      if (!response.ok) {
        throw new Error(apiErrorMessage(payload, "The product could not be removed."));
      }
      await loadCart();
      window.dispatchEvent(new Event(CART_CHANGED_EVENT));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The product could not be removed.");
    } finally {
      setBusyProductId(null);
    }
  }

  async function checkout() {
    if (checkoutBusy || !cart?.items.length) return;
    setCheckoutBusy(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401) {
        setNeedsSignIn(true);
        setError("Your sign-in has expired. Sign in again before checkout.");
        return;
      }
      if (!response.ok) {
        throw new Error(apiErrorMessage(payload, "Checkout could not be started."));
      }
      const checkoutUrl = safeCheckoutUrl(payload);
      if (!checkoutUrl) {
        throw new Error("Checkout is not configured with a valid payment URL.");
      }
      window.location.assign(checkoutUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkout could not be started.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  if (needsSignIn) {
    return (
      <section className={styles.signInPanel} aria-labelledby="cart-sign-in-title">
        <span>ACCOUNT CART</span>
        <h2 id="cart-sign-in-title">Sign in to view and save your cart</h2>
        <p>
          Thevenin stores carts with your account so quantities and server-confirmed prices
          persist between devices. No sample cart or browser-only cart is shown.
        </p>
        <Link className={styles.primaryButton} href={signInHref}>Sign in with ChatGPT</Link>
      </section>
    );
  }

  if (state === "loading") {
    return <div className={styles.statusPanel} role="status">Loading your saved cart…</div>;
  }

  if (state === "error") {
    return (
      <div className={styles.statusPanel} role="alert">
        <h2>Cart temporarily unavailable</h2>
        <p>{error}</p>
        <button className={styles.secondaryButton} type="button" onClick={() => void loadCart()}>Try again</button>
      </div>
    );
  }

  if (!cart?.items.length) {
    return (
      <section className={styles.statusPanel} aria-labelledby="empty-cart-title">
        {checkoutCancelled ? <p className={styles.notice}>Checkout was cancelled. No order was placed.</p> : null}
        <h2 id="empty-cart-title">Your cart is empty</h2>
        <p>Browse the live catalog and add a published product to start an order.</p>
        <Link className={styles.primaryButton} href="/store">Browse products</Link>
      </section>
    );
  }

  return (
    <>
      {checkoutCancelled ? (
        <p className={styles.notice} role="status">Checkout was cancelled. Your saved cart is unchanged.</p>
      ) : null}
      {error ? <p className={styles.errorNotice} role="alert">{error}</p> : null}
      <div className={styles.cartLayout}>
        <section className={styles.cartList} aria-label="Cart products">
          <div className={styles.listHead}>
            <h2>{itemCount} {itemCount === 1 ? "item" : "items"}</h2>
            {displayName ? <span>Saved for {displayName}</span> : null}
          </div>
          {cart.items.map((item) => {
            const busy = busyProductId === item.productId;
            return (
              <article className={styles.cartItem} key={item.id}>
                <CartImage item={item} />
                <div className={styles.itemCopy}>
                  <span>{item.product.category}</span>
                  <h3><Link href={`/store?product=${encodeURIComponent(item.product.slug)}`}>{item.product.name}</Link></h3>
                  <p>SKU {item.product.sku} · {stockLabel(item.product.stockStatus)}</p>
                  <button type="button" onClick={() => void removeItem(item)} disabled={busy}>
                    {busy ? "Updating…" : "Remove"}
                  </button>
                </div>
                <div className={styles.quantity} aria-label={`Quantity for ${item.product.name}`}>
                  <button
                    type="button"
                    onClick={() => void updateQuantity(item, item.quantity - 1)}
                    disabled={busy || item.quantity <= 1}
                    aria-label={`Decrease ${item.product.name} quantity`}
                  >−</button>
                  <span aria-live="polite">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => void updateQuantity(item, item.quantity + 1)}
                    disabled={busy || item.quantity >= 25}
                    aria-label={`Increase ${item.product.name} quantity`}
                  >+</button>
                </div>
                <div className={styles.itemPrice}>
                  <strong>{formatCurrency(item.unitPriceCents * item.quantity, cart.currency)}</strong>
                  <span>{formatCurrency(item.unitPriceCents, cart.currency)} each</span>
                </div>
              </article>
            );
          })}
        </section>

        <aside className={styles.summary} aria-labelledby="order-summary-title">
          <span>ORDER SUMMARY</span>
          <h2 id="order-summary-title">{formatCurrency(cart.subtotalCents, cart.currency)}</h2>
          <dl>
            <div><dt>Products</dt><dd>{itemCount}</dd></div>
            <div><dt>Subtotal</dt><dd>{formatCurrency(cart.subtotalCents, cart.currency)}</dd></div>
            <div><dt>Tax and shipping</dt><dd>Calculated at checkout</dd></div>
          </dl>
          <button
            className={styles.checkoutButton}
            type="button"
            onClick={() => void checkout()}
            disabled={checkoutBusy || Boolean(busyProductId)}
          >
            {checkoutBusy ? "Opening secure checkout…" : "Continue to secure checkout"}
          </button>
          <p>
            Checkout reads the signed-in database cart and current product prices directly.
            No price or total is accepted from this page.
          </p>
          <Link href="/store">← Continue shopping</Link>
        </aside>
      </div>
    </>
  );
}
