"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Mail, Save, Search } from "lucide-react";
import { adminRequest, errorMessage, shortDateTime } from "../admin-api";
import { EmptyState, ErrorState, LoadingState, PageHeading, StatusBadge, label } from "../admin-components";
import type { AdminInquiry, AdminUser, InquiryStatus } from "../admin-types";

type InquiryDraft = { status: InquiryStatus; notes: string; assignedToUserId: string };
const statuses: InquiryStatus[] = ["new", "in_progress", "resolved", "closed"];

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<AdminInquiry[] | null>(null);
  const [staff, setStaff] = useState<AdminUser[]>([]);
  const [drafts, setDrafts] = useState<Record<string, InquiryDraft>>({});
  const [openId, setOpenId] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | InquiryStatus>("all");
  const [type, setType] = useState<"all" | AdminInquiry["type"]>("all");
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [inquiryResponse, userResponse] = await Promise.all([
        adminRequest<{ inquiries: AdminInquiry[] }>("/api/admin/inquiries"),
        adminRequest<{ users: AdminUser[] }>("/api/admin/users"),
      ]);
      setInquiries(inquiryResponse.inquiries);
      setStaff(userResponse.users.filter((user) => user.status === "active" && ["staff", "admin"].includes(user.role)));
      setDrafts(Object.fromEntries(inquiryResponse.inquiries.map((inquiry) => [inquiry.id, toDraft(inquiry)])));
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (inquiries ?? []).filter((inquiry) => {
      const haystack = `${inquiry.name} ${inquiry.email} ${inquiry.company ?? ""} ${inquiry.message}`.toLowerCase();
      return (!needle || haystack.includes(needle)) && (status === "all" || inquiry.status === status) && (type === "all" || inquiry.type === type);
    });
  }, [inquiries, query, status, type]);

  function updateDraft(id: string, patch: Partial<InquiryDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
    setNotice("");
  }

  async function save(inquiry: AdminInquiry) {
    const draft = drafts[inquiry.id] ?? toDraft(inquiry);
    setWorkingId(inquiry.id);
    setError("");
    setNotice("");
    try {
      const response = await adminRequest<{ inquiry: AdminInquiry }>(`/api/admin/inquiries/${encodeURIComponent(inquiry.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: draft.status, notes: draft.notes.trim(), assignedToUserId: draft.assignedToUserId || null }),
      });
      const merged = { ...inquiry, ...response.inquiry };
      setInquiries((current) => current?.map((item) => item.id === inquiry.id ? merged : item) ?? null);
      setDrafts((current) => ({ ...current, [inquiry.id]: toDraft(merged) }));
      setNotice(`Inquiry from ${inquiry.name} updated.`);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setWorkingId("");
    }
  }

  return (
    <>
      <PageHeading eyebrow="Customer operations" title="Inquiries" description="Triage support, quote, sourcing, and license requests; assign owners and preserve internal notes." />
      {error ? <div className="admin-alert" role="alert">{error}</div> : null}
      {notice ? <div className="admin-alert" data-tone="success" role="status">{notice}</div> : null}
      <div className="admin-filter-bar">
        <div className="admin-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, company, or message" aria-label="Search inquiries" /></div>
        <div className="admin-filter-field"><label htmlFor="inquiry-type">Type</label><select id="inquiry-type" value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="all">All types</option><option value="support">Support</option><option value="quote">Quote</option><option value="sourcing">Sourcing</option><option value="license">License</option></select></div>
        <div className="admin-filter-field"><label htmlFor="inquiry-status">Status</label><select id="inquiry-status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></div>
      </div>
      <section className="admin-panel">
        {!inquiries && !error ? <LoadingState label="Loading inquiries…" /> : null}
        {!inquiries && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {inquiries && !filtered.length ? <EmptyState title="Inbox clear" detail="No inquiries match the selected filters." /> : null}
        {inquiries && filtered.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Customer</th><th>Type</th><th>Message</th><th>Owner</th><th>Status</th><th>Received</th><th><span className="admin-sr-only">Details</span></th></tr></thead>
              <tbody>{filtered.map((inquiry) => {
                const open = openId === inquiry.id;
                const draft = drafts[inquiry.id] ?? toDraft(inquiry);
                const owner = staff.find((user) => user.id === inquiry.assignedToUserId);
                return (
                  <Fragment key={inquiry.id}>
                    <tr>
                      <td><strong>{inquiry.name}</strong><small>{inquiry.company || inquiry.email}</small></td>
                      <td><StatusBadge value={inquiry.type} /></td>
                      <td><span className="admin-message-preview">{inquiry.message}</span></td>
                      <td>{owner?.displayName || (inquiry.assignedToUserId ? "Assigned" : "Unassigned")}</td>
                      <td><StatusBadge value={inquiry.status} /></td>
                      <td>{shortDateTime(inquiry.createdAt)}</td>
                      <td><button className="admin-icon-button" type="button" onClick={() => setOpenId(open ? "" : inquiry.id)} aria-expanded={open} aria-label={`${open ? "Close" : "Open"} inquiry details`}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button></td>
                    </tr>
                    {open ? <tr className="admin-detail-row"><td colSpan={7}><div className="admin-detail-panel">
                      <div className="admin-inquiry-message"><div><strong>{inquiry.name}</strong><span>{inquiry.email}{inquiry.phone ? ` · ${inquiry.phone}` : ""}</span></div><a className="admin-button admin-button--secondary" href={`mailto:${encodeURIComponent(inquiry.email)}`}><Mail size={13} /> Reply by email</a><p>{inquiry.message}</p>{inquiry.productId || inquiry.designId || inquiry.revisionId ? <small>Context: {[inquiry.productId && `product ${inquiry.productId}`, inquiry.designId && `design ${inquiry.designId}`, inquiry.revisionId && `revision ${inquiry.revisionId}`].filter(Boolean).join(" · ")}</small> : null}</div>
                      <div className="admin-inline-form admin-inline-form--wide">
                        <label>Status<select value={draft.status} onChange={(event) => updateDraft(inquiry.id, { status: event.target.value as InquiryStatus })}>{statuses.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
                        <label>Assigned to<select value={draft.assignedToUserId} onChange={(event) => updateDraft(inquiry.id, { assignedToUserId: event.target.value })}><option value="">Unassigned</option>{staff.map((user) => <option key={user.id} value={user.id}>{user.displayName || user.email}</option>)}</select></label>
                        <label>Internal notes<textarea value={draft.notes} onChange={(event) => updateDraft(inquiry.id, { notes: event.target.value })} placeholder="Next step, quote context, or resolution" /></label>
                        <button className="admin-button" type="button" disabled={workingId === inquiry.id} onClick={() => void save(inquiry)}><Save size={13} /> {workingId === inquiry.id ? "Saving…" : "Update inquiry"}</button>
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

function toDraft(inquiry: AdminInquiry): InquiryDraft {
  return { status: inquiry.status, notes: inquiry.adminNotes ?? "", assignedToUserId: inquiry.assignedToUserId ?? "" };
}

