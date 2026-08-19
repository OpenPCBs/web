"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";

type LabTier = "release-review" | "bench-reproduction" | "custom-campaign";

type LabCheckoutProps = {
  tier: LabTier;
  revisionId?: string;
  requestId?: string;
};

type Notice = { tone: "success" | "error"; message: string } | null;

export function LabCheckout({ tier, revisionId, requestId }: LabCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const isCustomQuote = tier === "custom-campaign";
  const hasContext = Boolean(revisionId || requestId);

  async function beginRequest() {
    if (!hasContext) return;
    setLoading(true);
    setNotice(null);

    try {
      if (isCustomQuote && requestId) {
        setNotice({
          tone: "success",
          message: "This custom verification request is already saved. Track its quote in your workspace.",
        });
        return;
      }

      const endpoint = isCustomQuote ? "/api/verification" : "/api/lab/checkout";
      const body = requestId ? { requestId } : { revisionId, tier };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        throw new Error(apiMessage(payload, "Unable to start this verification request."));
      }

      if (!isCustomQuote) {
        const url = objectString(payload, "url");
        if (!url) throw new Error("Stripe did not return a secure checkout link.");
        window.location.assign(url);
        return;
      }

      setNotice({
        tone: "success",
        message: "Custom campaign requested. The lab will define scope and send a payable quote before work begins.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to start this verification request.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (!hasContext) {
    return (
      <div className="checkout-action" data-state="needs-revision">
        <a className="button full-button" href="/marketplace">
          Choose a design revision <ArrowRight size={17} />
        </a>
        <p className="inline-notice">
          <CircleAlert size={16} /> Open verification from a published revision so its immutable ID is carried into the request.
        </p>
      </div>
    );
  }

  return (
    <div className="checkout-action" data-state={notice?.tone ?? "ready"}>
      <button className="button full-button" type="button" onClick={beginRequest} disabled={loading}>
        {loading ? <LoaderCircle className="spin" size={17} /> : null}
        {loading
          ? "Saving request…"
          : isCustomQuote
            ? "Request a scoped quote"
            : "Continue to secure checkout"}
        {!loading ? <ArrowRight size={17} /> : null}
      </button>
      {notice ? (
        <p className="inline-notice" role={notice.tone === "error" ? "alert" : "status"}>
          {notice.tone === "success" ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
          {notice.message}
        </p>
      ) : null}
    </div>
  );
}

function apiMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as Record<string, unknown>).error;
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string" && message) return message;
  }
  const message = (payload as Record<string, unknown>).message;
  return typeof message === "string" && message ? message : fallback;
}

function objectString(payload: unknown, key: string): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : undefined;
}
