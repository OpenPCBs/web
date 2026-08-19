"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Save, Search } from "lucide-react";
import { adminRequest, errorMessage, shortDate } from "../admin-api";
import { EmptyState, ErrorState, LoadingState, PageHeading, StatusBadge } from "../admin-components";
import type { AdminUser } from "../admin-types";

type UserDraft = Pick<AdminUser, "role" | "status">;

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>({});
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | AdminUser["status"]>("all");
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await adminRequest<{ users: AdminUser[] }>("/api/admin/users");
      setUsers(response.users);
      setDrafts(Object.fromEntries(response.users.map((user) => [user.id, { role: user.role, status: user.status }])));
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (users ?? []).filter((user) => {
      const name = `${user.displayName} ${user.fullName ?? ""} ${user.email}`.toLowerCase();
      return (!needle || name.includes(needle)) && (status === "all" || user.status === status);
    });
  }, [query, status, users]);

  function updateDraft(id: string, patch: Partial<UserDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
    setNotice("");
  }

  async function save(user: AdminUser) {
    const draft = drafts[user.id];
    if (!draft) return;
    setWorkingId(user.id);
    setError("");
    setNotice("");
    try {
      const response = await adminRequest<{ user: AdminUser }>(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify(draft) });
      setUsers((current) => current?.map((item) => item.id === user.id ? response.user : item) ?? null);
      setDrafts((current) => ({ ...current, [user.id]: { role: response.user.role, status: response.user.status } }));
      setNotice(`${response.user.displayName || response.user.email} updated.`);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setWorkingId("");
    }
  }

  return (
    <>
      <PageHeading eyebrow="Access control" title="Users" description="Manage staff access and suspend customer accounts without changing their order history." />
      {error ? <div className="admin-alert" role="alert">{error}</div> : null}
      {notice ? <div className="admin-alert" data-tone="success" role="status">{notice}</div> : null}
      <div className="admin-filter-bar">
        <div className="admin-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" aria-label="Search users" /></div>
        <div className="admin-filter-field"><label htmlFor="user-status">Account status</label><select id="user-status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">All users</option><option value="active">Active</option><option value="suspended">Suspended</option></select></div>
      </div>
      <section className="admin-panel">
        {!users && !error ? <LoadingState label="Loading users…" /> : null}
        {!users && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {users && !filtered.length ? <EmptyState title="No matching users" detail="Try a broader search or change the status filter." /> : null}
        {users && filtered.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>User</th><th>Current access</th><th>Role</th><th>Status</th><th>Joined</th><th><span className="admin-sr-only">Save</span></th></tr></thead>
              <tbody>{filtered.map((user) => {
                const draft = drafts[user.id] ?? { role: user.role, status: user.status };
                const dirty = draft.role !== user.role || draft.status !== user.status;
                return (
                  <tr key={user.id}>
                    <td><strong>{user.displayName || user.fullName || "Unnamed user"}</strong><small>{user.email}</small></td>
                    <td><StatusBadge value={user.role} /></td>
                    <td><select className="admin-table-select" aria-label={`Role for ${user.email}`} value={draft.role} onChange={(event) => updateDraft(user.id, { role: event.target.value as AdminUser["role"] })}><option value="customer">Customer</option><option value="staff">Staff</option><option value="admin">Admin</option></select></td>
                    <td><select className="admin-table-select" aria-label={`Status for ${user.email}`} value={draft.status} onChange={(event) => updateDraft(user.id, { status: event.target.value as AdminUser["status"] })}><option value="active">Active</option><option value="suspended">Suspended</option></select></td>
                    <td>{shortDate(user.createdAt)}</td>
                    <td><button className="admin-button admin-button--quiet" type="button" disabled={!dirty || workingId === user.id} onClick={() => void save(user)}><Save size={13} /> {workingId === user.id ? "Saving…" : "Save"}</button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}

