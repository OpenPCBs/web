"use client";

import Link from "./native-link";
import { ShoppingCart } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export const CART_CHANGED_EVENT = "thevenin:cart-changed";

function quantityFromPayload(payload: unknown): number {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return 0;
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) return 0;
  return items.reduce((total, value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return total;
    const quantity = (value as { quantity?: unknown }).quantity;
    return typeof quantity === "number" && Number.isInteger(quantity) && quantity > 0
      ? total + quantity
      : total;
  }, 0);
}

export function CartIndicator() {
  const [quantity, setQuantity] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/cart", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        setQuantity(0);
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      setQuantity(quantityFromPayload(payload));
    } catch {
      setQuantity(0);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handleCartChange = () => void refresh();
    window.addEventListener(CART_CHANGED_EVENT, handleCartChange);
    return () => window.removeEventListener(CART_CHANGED_EVENT, handleCartChange);
  }, [refresh]);

  return (
    <Link
      href="/cart"
      aria-label={`Cart, ${quantity} ${quantity === 1 ? "item" : "items"}`}
    >
      <ShoppingCart size={21} aria-hidden="true" />
      <span><small>{quantity} {quantity === 1 ? "item" : "items"}</small><b>Cart</b></span>
    </Link>
  );
}
