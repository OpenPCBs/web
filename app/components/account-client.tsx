"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "./native-link";
import { Box, CircleAlert, FileBadge, GitBranch, LoaderCircle, LogOut, PackageCheck, ShoppingBag } from "lucide-react";
import { AccountCheckoutStatus } from "./account-checkout-status";

type OrderItem = { id: string; name: string; sku: string; quantity: number; lineTotalCents: number };
type Order = { id: string; status: string; totalCents: number; currency: string; createdAt: string; items: OrderItem[] };
type Verification = {
  id: string;
  status: string;
  serviceLevel: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  design?: { title?: string; slug?: string };
  revision?: { id?: string; version?: string };
};
type Design = {
  id: string;
  slug: string;
  title: string;
  publicationStatus: string;
  updatedAt?: string;
  currentRevision?: { version?: string; verificationStatus?: string } | null;
};
type WorkspaceData = { orders: Order[]; requests: Verification[]; designs: Design[] };

export function AccountClient({
  user,
  checkout,
  sessionId,
  signOutHref,
}: {
  user: { displayName: string; email: string };
  checkout?: string;
  sessionId?: string;
  signOutHref: string;
}) {
  const [data, setData] = useState<WorkspaceData>({ orders: [], requests: [], designs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const responses = await Promise.all([
        fetch("/api/orders", { cache: "no-store" }),
        fetch("/api/verification", { cache: "no-store" }),
        fetch("/api/designs?mine=1", { cache: "no-store" }),
      ]);
      const payloads = await Promise.all(responses.map((response) => response.json() as Promise<unknown>));
      const failedIndex = responses.findIndex((response) => !response.ok);
      if (failedIndex >= 0) throw new Error(apiMessage(payloads[failedIndex], "Unable to load your workspace."));
      setData({
        orders: objectArray<Order>(payloads[0], "orders"),
        requests: objectArray<Verification>(payloads[1], "requests"),
        designs: objectArray<Design>(payloads[2], "designs"),
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load your workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const paidOrderCount = data.orders.filter((order) =>
    ["paid", "processing", "shipped", "completed"].includes(order.status),
  ).length;
  const activeVerifications = data.requests.filter((request) => !["verified", "failed", "cancelled"].includes(request.status)).length;
  const publishedDesigns = data.designs.filter((design) => design.publicationStatus === "published").length;

  return (
    <main className="account-shell shell">
      <aside className="account-nav">
        <span>THEVENIN WORKSPACE</span>
        <a href="#overview"><Box size={16} />Overview</a>
        <a href="#orders"><ShoppingBag size={16} />Orders</a>
        <a href="#designs"><GitBranch size={16} />Designs</a>
        <a href="#verification"><FileBadge size={16} />Verification</a>
        <a href={signOutHref}><LogOut size={16} />Sign out</a>
      </aside>
      <section className="account-main">
        <header className="account-heading" id="overview">
          <div><span>YOUR ACCOUNT</span><h1>{firstName(user.displayName)}’s workspace</h1><p>{user.email}</p></div>
          <button type="button" onClick={() => void load()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={15} /> : null}{loading ? "Refreshing…" : "Refresh"}</button>
        </header>
        <AccountCheckoutStatus checkout={checkout} sessionId={sessionId} />
        {error ? <div className="account-error" role="alert"><CircleAlert size={18} /><span>{error}</span><button onClick={() => void load()}>Try again</button></div> : null}
        <div className="account-stats">
          <article><span>Orders</span><b>{data.orders.length}</b><small>{paidOrderCount} paid or fulfilled</small></article>
          <article><span>Active verification</span><b>{activeVerifications}</b><small>{data.requests.length} total requests</small></article>
          <article><span>Published designs</span><b>{publishedDesigns}</b><small>{data.designs.length} drafts and releases</small></article>
        </div>

        <WorkspaceSection id="orders" title="Orders" action={<Link href="/store">Shop products</Link>}>
          {data.orders.length ? <div className="account-records">{data.orders.map((order) => (
            <article key={order.id}>
              <div><span>{shortReference(order.id, "ORDER")}</span><h3>{order.items?.length ? order.items.map((item) => `${item.quantity}× ${item.name}`).join(", ") : "Order"}</h3><p>{formatDate(order.createdAt)}</p></div>
              <div className="account-record-meta"><Status value={order.status} /><b>{formatMoney(order.totalCents, order.currency)}</b></div>
            </article>
          ))}</div> : <Empty title="No orders yet" copy="Products added through the live catalog will appear here after checkout." href="/store" label="Browse catalog" />}
        </WorkspaceSection>

        <WorkspaceSection id="designs" title="Designs" action={<Link href="/sell">Publish a design</Link>}>
          {data.designs.length ? <div className="account-records">{data.designs.map((design) => (
            <article key={design.id}>
              <div><span>DESIGN</span><h3>{design.title}</h3><p>Revision {design.currentRevision?.version ?? "draft"}</p></div>
              <div className="account-record-meta"><Status value={design.publicationStatus} />{design.publicationStatus === "published" ? <Link href={`/designs/${design.slug}`}>View</Link> : <Link href={`/sell?designId=${encodeURIComponent(design.id)}`}>Continue</Link>}</div>
            </article>
          ))}</div> : <Empty title="No design drafts" copy="Create a private release, attach manufacturing files, then publish when it is complete." href="/sell" label="Start a design" />}
        </WorkspaceSection>

        <WorkspaceSection id="verification" title="Verification" action={<Link href="/lab">View service levels</Link>}>
          {data.requests.length ? <div className="account-records">{data.requests.map((request) => (
            <article key={request.id}>
              <div><span>{request.serviceLevel.replaceAll("_", " ")}</span><h3>{request.design?.title ?? "Verification request"}</h3><p>Revision {request.revision?.version ?? request.revision?.id ?? "—"} · {formatDate(request.createdAt)}</p></div>
              <div className="account-record-meta"><Status value={request.status} />{verificationAction(request)}</div>
            </article>
          ))}</div> : <Empty title="No verification requests" copy="Verification starts from an immutable design revision, so every report stays tied to the exact files tested." href="/sell" label="Create a revision" />}
        </WorkspaceSection>
      </section>
    </main>
  );
}

function WorkspaceSection({ id, title, action, children }: { id: string; title: string; action: React.ReactNode; children: React.ReactNode }) {
  return <section className="account-section" id={id}><header><h2>{title}</h2>{action}</header>{children}</section>;
}
function Empty({ title, copy, href, label }: { title: string; copy: string; href: string; label: string }) {
  return <div className="account-empty"><PackageCheck size={22} /><h3>{title}</h3><p>{copy}</p><Link href={href}>{label} →</Link></div>;
}
function Status({ value }: { value: string }) {
  return <span className="account-status" data-status={value}>{value.replaceAll("_", " ")}</span>;
}
function verificationAction(request: Verification) {
  if (!["quoted", "payment_pending"].includes(request.status) || !request.revision?.id) return null;
  const tier = canonicalVerificationTier(request.serviceLevel);
  if (!tier) return null;
  const params = new URLSearchParams({ requestId: request.id, revisionId: request.revision.id, tier });
  return <Link href={`/lab?${params.toString()}`}>{tier === "custom-campaign" ? "View request" : "Continue payment"}</Link>;
}
function canonicalVerificationTier(value: string): string | null {
  if (value === "release_review" || value === "release-review") return "release-review";
  if (value === "bench_reproduction" || value === "bench-reproduction") return "bench-reproduction";
  if (value === "custom_campaign" || value === "custom-campaign") return "custom-campaign";
  return null;
}
function firstName(value: string) { return value.split(/[\s@]/)[0] || "Customer"; }
function shortReference(value: string, prefix: string) { return `${prefix} · ${value.slice(0, 8).toUpperCase()}`; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "Date unavailable" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date); }
function formatMoney(cents: number, currency: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format((Number(cents) || 0) / 100); }
function objectArray<T>(payload: unknown, key: string): T[] { if (!payload || typeof payload !== "object") return []; const value = (payload as Record<string, unknown>)[key]; return Array.isArray(value) ? value as T[] : []; }
function apiMessage(payload: unknown, fallback: string) { if (!payload || typeof payload !== "object") return fallback; const error = (payload as Record<string, unknown>).error; if (typeof error === "string") return error; if (error && typeof error === "object" && typeof (error as Record<string, unknown>).message === "string") return String((error as Record<string, unknown>).message); return fallback; }
