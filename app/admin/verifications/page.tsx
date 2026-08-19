"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Save, Search } from "lucide-react";
import { adminRequest, errorMessage, money, shortDateTime } from "../admin-api";
import { EmptyState, ErrorState, LoadingState, PageHeading, StatusBadge, label } from "../admin-components";
import type { AdminVerification, VerificationStatus } from "../admin-types";

type VerificationDraft = { status: VerificationStatus; message: string; badgeExpiresAt: string };

const statuses: VerificationStatus[] = ["quoted", "payment_pending", "paid", "in_review", "verified", "failed", "cancelled"];

export default function VerificationsPage() {
  const [items, setItems] = useState<AdminVerification[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, VerificationDraft>>({});
  const [openId, setOpenId] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | VerificationStatus>("all");
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await adminRequest<{ verifications: AdminVerification[] }>("/api/admin/verifications");
      setItems(response.verifications);
      setDrafts(Object.fromEntries(response.verifications.map((item) => [item.id, toDraft(item)])));
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (items ?? []).filter((item) => {
      const haystack = `${item.id} ${item.design?.title ?? ""} ${item.revision?.version ?? ""} ${item.user?.email ?? ""}`.toLowerCase();
      return (!needle || haystack.includes(needle)) && (status === "all" || item.status === status);
    });
  }, [items, query, status]);

  function updateDraft(id: string, patch: Partial<VerificationDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
    setNotice("");
  }

  async function save(item: AdminVerification) {
    const draft = drafts[item.id] ?? toDraft(item);
    setWorkingId(item.id);
    setError("");
    setNotice("");
    try {
      const response = await adminRequest<{ verification: AdminVerification }>(`/api/admin/verifications/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: draft.status,
          message: draft.message.trim() || undefined,
          badgeExpiresAt: draft.badgeExpiresAt ? new Date(draft.badgeExpiresAt).toISOString() : undefined,
        }),
      });
      const merged = { ...item, ...response.verification };
      setItems((current) => current?.map((currentItem) => currentItem.id === item.id ? merged : currentItem) ?? null);
      setDrafts((current) => ({ ...current, [item.id]: toDraft(merged) }));
      setNotice(`Verification request ${item.id.slice(0, 10)} updated.`);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setWorkingId("");
    }
  }

  return (
    <>
      <PageHeading eyebrow="Thevenin Works lab" title="Verification queue" description="Move paid requests through review, record customer-facing status events, and issue revision-bound verification." />
      {error ? <div className="admin-alert" role="alert">{error}</div> : null}
      {notice ? <div className="admin-alert" data-tone="success" role="status">{notice}</div> : null}
      <div className="admin-filter-bar">
        <div className="admin-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search request, design, revision, or customer" aria-label="Search verification requests" /></div>
        <div className="admin-filter-field"><label htmlFor="verification-status">Status</label><select id="verification-status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">All requests</option>{statuses.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></div>
      </div>

      <section className="admin-panel">
        {!items && !error ? <LoadingState label="Loading verification queue…" /> : null}
        {!items && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {items && !filtered.length ? <EmptyState title="Queue is clear" detail="No verification requests match the selected filters." /> : null}
        {items && filtered.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Request</th><th>Design / revision</th><th>Customer</th><th>Service</th><th>Amount</th><th>Status</th><th>Submitted</th><th><span className="admin-sr-only">Details</span></th></tr></thead>
              <tbody>{filtered.map((item) => {
                const open = openId === item.id;
                const draft = drafts[item.id] ?? toDraft(item);
                return (
                  <Fragment key={item.id}>
                    <tr>
                      <td><strong>{item.id.slice(0, 12)}</strong><small>{item.paidAt ? `Paid ${shortDateTime(item.paidAt)}` : "Not paid"}</small></td>
                      <td><strong>{item.design?.title || item.designId}</strong><small>Revision {item.revision?.version || item.revisionId}</small></td>
                      <td><strong>{item.user?.displayName || "Customer"}</strong><small>{item.user?.email || item.userId}</small></td>
                      <td><StatusBadge value={item.serviceLevel} /></td>
                      <td><strong>{money(item.amountCents, item.currency)}</strong></td>
                      <td><StatusBadge value={item.status} /></td>
                      <td>{shortDateTime(item.createdAt)}</td>
                      <td><button className="admin-icon-button" type="button" onClick={() => setOpenId(open ? "" : item.id)} aria-expanded={open} aria-label={`${open ? "Close" : "Open"} verification details`}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button></td>
                    </tr>
                    {open ? <tr className="admin-detail-row"><td colSpan={8}><div className="admin-detail-panel">
                      {item.notes ? <p className="admin-case-note"><strong>Submission notes</strong>{item.notes}</p> : null}
                      <div className="admin-inline-form admin-inline-form--wide">
                        <label>Status<select value={draft.status} onChange={(event) => updateDraft(item.id, { status: event.target.value as VerificationStatus })}>{statuses.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
                        <label>Badge expiry<input type="datetime-local" value={draft.badgeExpiresAt} onChange={(event) => updateDraft(item.id, { badgeExpiresAt: event.target.value })} /></label>
                        <label>Customer event message<input value={draft.message} onChange={(event) => updateDraft(item.id, { message: event.target.value })} placeholder="What changed and what happens next" /></label>
                        <button className="admin-button" type="button" disabled={workingId === item.id} onClick={() => void save(item)}><Save size={13} /> {workingId === item.id ? "Saving…" : "Update request"}</button>
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

function toDraft(item: AdminVerification): VerificationDraft {
  return { status: item.status, message: "", badgeExpiresAt: toLocalDateTime(item.badgeExpiresAt) };
}

function toLocalDateTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

