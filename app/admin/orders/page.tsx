"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Save, Search } from "lucide-react";
import { adminRequest, errorMessage, money, shortDateTime } from "../admin-api";
import { EmptyState, ErrorState, LoadingState, PageHeading, StatusBadge } from "../admin-components";
import type { AdminOrder } from "../admin-types";

type OrderDraft = { status: AdminOrder["status"] | ""; note: string; trackingNumber: string };

const orderStatuses: AdminOrder["status"][] = ["pending", "paid", "payment_failed", "processing", "shipped", "completed", "cancelled", "refunded"];

export default function OrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, OrderDraft>>({});
  const [openId, setOpenId] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | AdminOrder["status"]>("all");
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await adminRequest<{ orders: AdminOrder[] }>("/api/admin/orders");
      setOrders(response.orders);
      setDrafts(Object.fromEntries(response.orders.map((order) => [order.id, toDraft(order)])));
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (orders ?? []).filter((order) => {
      const customer = `${order.user?.displayName ?? ""} ${order.user?.email ?? ""} ${order.id}`.toLowerCase();
      return (!needle || customer.includes(needle)) && (status === "all" || order.status === status);
    });
  }, [orders, query, status]);

  function updateDraft(id: string, patch: Partial<OrderDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
    setNotice("");
  }

  async function save(order: AdminOrder) {
    const draft = drafts[order.id] ?? toDraft(order);
    setWorkingId(order.id);
    setError("");
    setNotice("");
    try {
      const response = await adminRequest<{ order: AdminOrder }>(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(draft.status ? { status: draft.status } : {}),
          note: draft.note.trim() || undefined,
          trackingNumber: draft.trackingNumber.trim() || undefined,
        }),
      });
      const merged = { ...order, ...response.order };
      setOrders((current) => current?.map((item) => item.id === order.id ? merged : item) ?? null);
      setDrafts((current) => ({ ...current, [order.id]: toDraft(merged) }));
      setNotice(`Order ${order.id.slice(0, 12)} updated.`);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setWorkingId("");
    }
  }

  return (
    <>
      <PageHeading eyebrow="Fulfillment" title="Orders" description="Review paid orders, update fulfillment state, and record tracking or internal handoff notes." />
      {error ? <div className="admin-alert" role="alert">{error}</div> : null}
      {notice ? <div className="admin-alert" data-tone="success" role="status">{notice}</div> : null}
      <div className="admin-filter-bar">
        <div className="admin-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order ID, customer, or email" aria-label="Search orders" /></div>
        <div className="admin-filter-field"><label htmlFor="order-status">Status</label><select id="order-status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">All orders</option>{orderStatuses.map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></div>
      </div>
      <section className="admin-panel">
        {!orders && !error ? <LoadingState label="Loading orders…" /> : null}
        {!orders && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {orders && !filtered.length ? <EmptyState title="No matching orders" detail="No orders match the current search and status filter." /> : null}
        {orders && filtered.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Placed</th><th><span className="admin-sr-only">Details</span></th></tr></thead>
              <tbody>{filtered.map((order) => {
                const open = openId === order.id;
                const draft = drafts[order.id] ?? toDraft(order);
                const transitions = orderTransitions[order.status];
                return (
                  <Fragment key={order.id}>
                    <tr>
                      <td><strong>{order.id.slice(0, 12)}</strong><small>{order.paymentIntentId ? `Payment ${order.paymentIntentId.slice(0, 12)}` : "No payment reference"}</small></td>
                      <td><strong>{order.user?.displayName || "Customer"}</strong><small>{order.user?.email || order.userId}</small></td>
                      <td>{order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0}</td>
                      <td><strong>{money(order.totalCents, order.currency)}</strong></td>
                      <td><StatusBadge value={order.status} /></td>
                      <td>{shortDateTime(order.createdAt)}</td>
                      <td><button className="admin-icon-button" type="button" onClick={() => setOpenId(open ? "" : order.id)} aria-expanded={open} aria-label={`${open ? "Close" : "Open"} order details`}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button></td>
                    </tr>
                    {open ? <tr className="admin-detail-row"><td colSpan={7}><div className="admin-detail-panel">
                      {order.items?.length ? <table className="admin-order-items"><tbody>{order.items.map((item, index) => <tr key={item.id ?? `${item.sku}-${index}`}><td><strong>{item.name}</strong><small>{item.sku}</small></td><td>{item.quantity} × {money(item.unitPriceCents, order.currency)}</td><td><strong>{money(item.lineTotalCents, order.currency)}</strong></td></tr>)}</tbody></table> : <p className="admin-note">No item detail was returned for this order.</p>}
                      <div className="admin-inline-form admin-inline-form--wide">
                        <label>Status{transitions.length ? <select value={draft.status} onChange={(event) => updateDraft(order.id, { status: event.target.value as AdminOrder["status"] | "" })}><option value="">Keep {optionLabel(order.status)}</option>{transitions.map((value) => <option key={value} value={value}>Move to {optionLabel(value)}</option>)}</select> : <span><StatusBadge value={order.status} /><small>No manual status transitions are available.</small></span>}</label>
                        <label>Tracking number<input value={draft.trackingNumber} onChange={(event) => updateDraft(order.id, { trackingNumber: event.target.value })} placeholder="Carrier tracking reference" /></label>
                        <label>Internal note<input value={draft.note} onChange={(event) => updateDraft(order.id, { note: event.target.value })} placeholder="Optional fulfillment note" /></label>
                        <button className="admin-button" type="button" disabled={workingId === order.id} onClick={() => void save(order)}><Save size={13} /> {workingId === order.id ? "Saving…" : "Update order"}</button>
                      </div>
                    </div></td></tr> : null}
                  </Fragment>
                );
              })}</tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}

function toDraft(order: AdminOrder): OrderDraft {
  return { status: "", note: order.note ?? "", trackingNumber: order.trackingNumber ?? "" };
}

const orderTransitions: Record<AdminOrder["status"], readonly AdminOrder["status"][]> = {
  pending: ["cancelled"],
  paid: ["processing"],
  payment_failed: ["cancelled"],
  processing: ["shipped", "completed"],
  shipped: ["completed"],
  completed: [],
  cancelled: [],
  refunded: [],
};

function optionLabel(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
