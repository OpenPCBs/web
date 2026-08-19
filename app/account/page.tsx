import type { Metadata } from "next";
import { Bell, Box, CircleDollarSign, FileBadge, GitBranch, PackageCheck, Settings, ShoppingBag } from "lucide-react";
import { AccountCheckoutStatus } from "../components/account-checkout-status";
import { SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata: Metadata = { title: "Workspace", description: "Manage designs, revisions, verification requests, orders, seller payouts, and account settings." };
type AccountSearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined, maxLength: number): string | undefined {
  const result = Array.isArray(value) ? value[0] : value;
  return result?.trim().slice(0, maxLength) || undefined;
}

export default async function AccountPage({ searchParams }: { searchParams: AccountSearchParams }) {
  const params = await searchParams;
  const checkout = first(params.checkout, 40);
  const sessionId = first(params.session_id, 220);
  return <><SiteHeader /><main className="dashboard shell"><aside className="dashboard-nav"><span className="micro-label">THEVENIN WORKSPACE</span><a className="active" href="#overview"><Box size={16} />Overview</a><a href="#designs"><GitBranch size={16} />My designs</a><a href="#orders"><ShoppingBag size={16} />Orders</a><a href="#verification"><FileBadge size={16} />Verification</a><a href="#payouts"><CircleDollarSign size={16} />Payouts</a><a href="#settings"><Settings size={16} />Settings</a></aside><section className="dashboard-main"><div className="dashboard-head"><div><span className="kicker">GOOD MORNING</span><h1>Engineering workspace</h1></div><button className="icon-link" aria-label="Notifications"><Bell size={18} /></button></div><AccountCheckoutStatus checkout={checkout} sessionId={sessionId} /><div className="dashboard-stats"><article><span>Design revenue</span><b>$2,418</b><small>+$680 this month</small></article><article><span>Hardware referrals</span><b>$386</b><small>14 attributed orders</small></article><article><span>Verification</span><b>1 active</b><small>Bench testing · day 4</small></article><article><span>Published revisions</span><b>8</b><small>3 public designs</small></article></div><div className="dashboard-grid"><article><div className="panel-head"><div><span className="micro-label">ACTIVE VERIFICATION</span><h2>VF-3K-GAN · rev 1.4</h2></div><span className="status-pill amber">TESTING</span></div><div className="timeline"><span className="done">Submitted</span><span className="done">Paid</span><span className="done">Lab accepted</span><span className="active">Testing</span><span>Report ready</span></div><p>Thermal steady-state and full-load efficiency sweep are in progress. Latest evidence added 2 hours ago.</p><a className="text-link" href="/lab">View work order <span>→</span></a></article><article><div className="panel-head"><div><span className="micro-label">RECENT ORDER</span><h2>TV-10482</h2></div><PackageCheck size={22} /></div><p>3 kW GaN design license + full BOM kit</p><dl><div><dt>Digital files</dt><dd>Delivered</dd></div><div><dt>Components</dt><dd>Sourcing</dd></div><div><dt>PCB fabrication</dt><dd>Quoted</dd></div></dl><a className="text-link" href="/cart">Track order <span>→</span></a></article></div></section></main><SiteFooter /></>;
}
