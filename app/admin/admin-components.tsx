"use client";

import type { ReactNode } from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="admin-page-heading">
      <div><span className="admin-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {actions ? <div className="admin-heading-actions">{actions}</div> : null}
    </div>
  );
}

export function StatusBadge({ value }: { value: string }) {
  return <span className="admin-badge" data-tone={statusTone(value)}>{label(value)}</span>;
}

export function LoadingState({ label = "Loading operations data…" }: { label?: string }) {
  return <div className="admin-loading"><LoaderCircle size={22} /><span>{label}</span></div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="admin-error">
      <AlertTriangle size={24} /><strong>Unable to load this section</strong><p>{message}</p>
      {onRetry ? <button className="admin-button admin-button--secondary" type="button" onClick={onRetry}>Try again</button> : null}
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="admin-empty"><strong>{title}</strong><p>{detail}</p></div>;
}

export function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(value: string): "green" | "orange" | "red" | "blue" | undefined {
  if (["published", "active", "paid", "completed", "verified", "resolved", "in_stock", "configured"].includes(value)) return "green";
  if (["draft", "pending", "processing", "in_progress", "in_review", "payment_pending", "quoted", "backorder", "new"].includes(value)) return "orange";
  if (["archived", "suspended", "cancelled", "failed", "payment_failed", "refunded", "out_of_stock", "discontinued", "closed"].includes(value)) return "red";
  if (["staff", "admin", "shipped", "bench_reproduction"].includes(value)) return "blue";
  return undefined;
}
