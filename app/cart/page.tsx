import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/site-shell";
import { CartClient } from "../components/cart-client";

export const metadata: Metadata = { title: "Cart", description: "Review design licenses, BOM kits, hardware, and fulfillment before checkout." };
export default function CartPage() { return <><SiteHeader /><main className="section shell"><div className="page-title"><span className="kicker">PROCUREMENT</span><h1>Your cart</h1><p>Digital IP and the physical build stay connected, with itemized pricing and seller attribution.</p></div><CartClient /></main><SiteFooter /></>; }
