"use client";

import Link from "../components/native-link";
import { useCallback, useEffect, useState } from "react";
import { Boxes, ClipboardCheck, Inbox, Plus, ShoppingBag, UsersRound } from "lucide-react";
import { adminRequest, errorMessage, money, shortDateTime } from "./admin-api";
import { ErrorState, LoadingState, PageHeading, StatusBadge } from "./admin-components";
import type { AdminInquiry, AdminOrder, AdminProduct, AdminUser, AdminVerification } from "./admin-types";

type DashboardData = {
  products: AdminProduct[];
  users: AdminUser[];
  orders: AdminOrder[];
  verifications: AdminVerification[];
  inquiries: AdminInquiry[];
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [products, users, orders, verifications, inquiries] = await Promise.all([
        adminRequest<{ products: AdminProduct[] }>("/api/admin/products"),
        adminRequest<{ users: AdminUser[] }>("/api/admin/users"),
        adminRequest<{ orders: AdminOrder[] }>("/api/admin/orders"),
        adminRequest<{ verifications: AdminVerification[] }>("/api/admin/verifications"),
        adminRequest<{ inquiries: AdminInquiry[] }>("/api/admin/inquiries"),
      ]);
      setData({ products: products.products, users: users.users, orders: orders.orders, verifications: verifications.verifications, inquiries: inquiries.inquiries });
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const published = data?.products.filter((product) => product.status === "published").length ?? 0;
  const activeUsers = data?.users.filter((user) => user.status === "active").length ?? 0;
  const openOrders = data?.orders.filter((order) => !["completed", "cancelled", "refunded"].includes(order.status)).length ?? 0;
  const queue = data?.verifications.filter((item) => ["paid", "in_review"].includes(item.status)).length ?? 0;
  const newInquiries = data?.inquiries.filter((item) => item.status === "new").length ?? 0;
  const recentOrders = [...(data?.orders ?? [])].sort(byNewest).slice(0, 6);
  const activeVerifications = [...(data?.verifications ?? [])].filter((item) => !["verified", "failed", "cancelled"].includes(item.status)).sort(byNewest).slice(0, 6);

  return (
    <>
      <PageHeading
        eyebrow="Operations overview"
        title="Admin dashboard"
        description="A live view of catalog readiness, customer activity, fulfillment, and verification work."
        actions={<Link className="admin-button" href="/admin/products/new"><Plus size={15} /> New product</Link>}
      />

      {error ? <div className="admin-panel"><ErrorState message={error} onRetry={() => void load()} /></div> : null}
      {!data && !error ? <div className="admin-panel"><LoadingState /></div> : null}
      {data ? (
        <>
          <section className="admin-stat-grid" aria-label="Operational summary">
            <article className="admin-stat-card"><span>Published products <Boxes size={18} /></span><span><strong>{published}</strong><small>{data.products.length} total catalog records</small></span></article>
            <article className="admin-stat-card"><span>Active users <UsersRound size={18} /></span><span><strong>{activeUsers}</strong><small>{data.users.length} registered accounts</small></span></article>
            <article className="admin-stat-card"><span>Open orders <ShoppingBag size={18} /></span><span><strong>{openOrders}</strong><small>{data.orders.length} orders across all statuses</small></span></article>
            <article className="admin-stat-card"><span>Verification queue <ClipboardCheck size={18} /></span><span><strong>{queue}</strong><small>{newInquiries} new customer {newInquiries === 1 ? "inquiry" : "inquiries"}</small></span></article>
          </section>

          <section className="admin-dashboard-grid">
            <article className="admin-panel">
              <header className="admin-panel-heading"><div><h2>Recent orders</h2><p>Latest customer checkouts and fulfillment state</p></div><Link href="/admin/orders">View all</Link></header>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Created</th></tr></thead>
                  <tbody>
                    {recentOrders.length ? recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td><strong>{order.id.slice(0, 12)}</strong><small>{order.items?.length ?? 0} line items</small></td>
                        <td>{order.user?.displayName || order.user?.email || order.userId}</td>
                        <td><strong>{money(order.totalCents, order.currency)}</strong></td>
                        <td><StatusBadge value={order.status} /></td>
                        <td>{shortDateTime(order.createdAt)}</td>
                      </tr>
                    )) : <tr><td className="admin-table-empty" colSpan={5}>No orders yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="admin-panel">
              <header className="admin-panel-heading"><div><h2>Verification work</h2><p>Quoted, paid, and active requests</p></div><Link href="/admin/verifications">Open queue</Link></header>
              <ul className="admin-list">
                {activeVerifications.length ? activeVerifications.map((item) => (
                  <li key={item.id}>
                    <span><strong>{item.design?.title || `Request ${item.id.slice(0, 8)}`}</strong><small>Rev {item.revision?.version || item.revisionId.slice(0, 8)} · {money(item.amountCents, item.currency)}</small></span>
                    <StatusBadge value={item.status} />
                  </li>
                )) : <li><span><strong>Queue clear</strong><small>No active verification requests.</small></span></li>}
              </ul>
              {newInquiries ? <div className="admin-panel-body"><Link className="admin-button admin-button--secondary" href="/admin/inquiries"><Inbox size={14} /> Review {newInquiries} new {newInquiries === 1 ? "inquiry" : "inquiries"}</Link></div> : null}
            </article>
          </section>
        </>
      ) : null}
    </>
  );
}

function byNewest(left: { createdAt?: string }, right: { createdAt?: string }): number {
  return Date.parse(right.createdAt ?? "") - Date.parse(left.createdAt ?? "");
}
