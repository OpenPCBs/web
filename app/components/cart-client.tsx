"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Minus, Plus, ShieldCheck, Trash2 } from "lucide-react";

const initialItems = [
  { id: "design", kind: "Digital license", name: "3 kW GaN LLC Converter — Design files", seller: "VoltForge Labs", price: 79, quantity: 1 },
  { id: "kit", kind: "Build kit", name: "VF-3K-GAN complete BOM kit", seller: "Thevenin Supply", price: 1684, quantity: 1 },
];

export function CartClient() {
  const [items, setItems] = useState(initialItems);
  useEffect(() => {
    const saved = window.localStorage.getItem("thevenin-cart") ?? window.localStorage.getItem("aureline-cart") ?? window.localStorage.getItem("openpcbs-cart");
    if (saved) {
      try { setItems(JSON.parse(saved)); } catch { /* keep the safe seed cart */ }
    }
  }, []);
  useEffect(() => { window.localStorage.setItem("thevenin-cart", JSON.stringify(items)); }, [items]);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);

  function change(id: string, delta: number) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  }

  return (
    <div className="cart-layout">
      <section className="cart-list">
        {items.length ? items.map((item) => (
          <article className="cart-item" key={item.id}>
            <div className={`cart-thumb cart-thumb-${item.id}`}><span>{item.id === "design" ? "IP" : "KIT"}</span></div>
            <div className="cart-copy"><span className="micro-label">{item.kind}</span><h2>{item.name}</h2><p>Sold by {item.seller}</p><button onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}><Trash2 size={15} /> Remove</button></div>
            <div className="quantity"><button onClick={() => change(item.id, -1)} aria-label={`Decrease ${item.name}`}><Minus size={14} /></button><span>{item.quantity}</span><button onClick={() => change(item.id, 1)} aria-label={`Increase ${item.name}`}><Plus size={14} /></button></div>
            <strong>${(item.price * item.quantity).toLocaleString()}</strong>
          </article>
        )) : <div className="empty-panel"><h2>Your cart is empty</h2><p>Browse designs and add a license, build kit, or complete BOM.</p><Link className="button" href="/marketplace">Browse marketplace</Link></div>}
      </section>
      <aside className="order-summary">
        <span className="micro-label">Order summary</span><h2>${subtotal.toLocaleString()}</h2>
        <div><span>Subtotal</span><b>${subtotal.toLocaleString()}</b></div><div><span>Estimated shipping</span><b>Calculated next</b></div><div><span>Digital delivery</span><b>Immediate</b></div>
        <Link className="button full-button" href="/account?checkout=1">Continue to checkout <span>→</span></Link>
        <p><ShieldCheck size={16} /> Seller payout is held until the digital package and fulfillment handoff are confirmed.</p>
      </aside>
    </div>
  );
}
