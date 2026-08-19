"use client";

import { type FormEvent, useState } from "react";
import { CheckCircle2, CircleAlert, LoaderCircle, Send } from "lucide-react";

const inquiryTypes = [
  ["support", "Order or technical support"],
  ["quote", "Product or project quote"],
  ["sourcing", "Sourcing request"],
  ["license", "Design license or custom build"],
] as const;

type InquiryType = (typeof inquiryTypes)[number][0];
type Notice = { tone: "success" | "error"; message: string; reference?: string } | null;

export function ContactForm({
  initialType,
  context,
}: {
  initialType: InquiryType;
  context?: string;
}) {
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true);
    setNotice(null);
    const form = new FormData(formElement);

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: String(form.get("type") ?? "support"),
          name: String(form.get("name") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
          company: String(form.get("company") ?? "").trim(),
          subject: String(form.get("subject") ?? "").trim(),
          message: String(form.get("message") ?? "").trim(),
          context: String(form.get("context") ?? "").trim(),
          website: String(form.get("website") ?? ""),
        }),
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) throw new Error(apiMessage(payload));
      const reference = objectString(payload, "reference") ?? objectString(payload, "id");
      setNotice({
        tone: "success",
        reference,
        message: "Your request is in the operations queue. We’ll respond using the email you provided.",
      });
      formElement.reset();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "We could not save your request. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="contact-form-grid">
        <label>
          Request type
          <select name="type" defaultValue={initialType}>
            {inquiryTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Name
          <input name="name" autoComplete="name" required maxLength={120} />
        </label>
        <label>
          Work email
          <input name="email" type="email" autoComplete="email" required maxLength={200} />
        </label>
        <label>
          Company <span>Optional</span>
          <input name="company" autoComplete="organization" maxLength={160} />
        </label>
      </div>
      <label>
        Subject
        <input name="subject" required maxLength={180} defaultValue={context ? `Request regarding ${context}` : ""} />
      </label>
      <label>
        Requirements or issue
        <textarea name="message" required minLength={20} maxLength={6000} rows={8} placeholder="Include part numbers, quantities, target date, operating requirements, order number, or the exact help you need." />
      </label>
      <input type="hidden" name="context" value={context ?? ""} />
      <label className="contact-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <button className="commerce-button contact-submit" type="submit" disabled={saving}>
        {saving ? <LoaderCircle className="spin" size={17} /> : <Send size={16} />}
        {saving ? "Saving request…" : "Send request"}
      </button>
      {notice ? (
        <p className="contact-notice" data-tone={notice.tone} role={notice.tone === "error" ? "alert" : "status"}>
          {notice.tone === "success" ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}
          <span>{notice.message}{notice.reference ? <small>Reference {notice.reference}</small> : null}</span>
        </p>
      ) : null}
    </form>
  );
}

function apiMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "We could not save your request. Please try again.";
  const error = (payload as Record<string, unknown>).error;
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string" && message) return message;
  }
  const message = (payload as Record<string, unknown>).message;
  return typeof message === "string" && message ? message : "We could not save your request. Please try again.";
}

function objectString(payload: unknown, key: string): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : undefined;
}
