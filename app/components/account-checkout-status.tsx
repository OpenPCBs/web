"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";

type CheckoutState =
  | { kind: "loading"; message: string }
  | { kind: "success"; message: string }
  | { kind: "pending"; message: string }
  | { kind: "error"; message: string; authenticationRequired?: boolean };

export function AccountCheckoutStatus({
  checkout,
  sessionId,
}: {
  checkout?: string;
  sessionId?: string;
}) {
  const [state, setState] = useState<CheckoutState | null>(
    (checkout === "verification" || checkout === "order") && sessionId
      ? { kind: "loading", message: checkout === "order" ? "Confirming your order payment with Stripe…" : "Confirming your lab payment with Stripe…" }
      : null,
  );

  useEffect(() => {
    if ((checkout !== "verification" && checkout !== "order") || !sessionId) return;
    const controller = new AbortController();

    async function reconcile() {
      try {
        const response = await fetch(
          `${checkout === "order" ? "/api/checkout/complete" : "/api/verification/checkout/complete"}?session_id=${encodeURIComponent(sessionId!)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const payload = (await response.json()) as unknown;
        if (!response.ok) {
          setState({
            kind: "error",
            message: apiMessage(payload, "We could not confirm this payment."),
            authenticationRequired: response.status === 401,
          });
          return;
        }
        const paid = objectBoolean(payload, "paid");
        setState(
          paid
            ? {
                kind: "success",
                message: checkout === "order" ? "Payment confirmed. Your order is now in the fulfillment queue." : "Payment confirmed. Your revision-bound verification is now queued for lab intake.",
              }
            : {
                kind: "pending",
                message: "Stripe is still processing this payment. The request will update automatically when payment clears.",
              },
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          kind: "error",
          message: "We could not confirm this payment. No duplicate charge was created.",
        });
      }
    }

    void reconcile();
    return () => controller.abort();
  }, [checkout, sessionId]);

  if (!state) return null;
  return (
    <div
      className="request-notice account-checkout-status"
      data-state={state.kind}
      role={state.kind === "error" ? "alert" : "status"}
    >
      {state.kind === "loading" ? (
        <LoaderCircle className="spin" size={18} />
      ) : state.kind === "success" ? (
        <CheckCircle2 size={18} />
      ) : (
        <CircleAlert size={18} />
      )}
      <span>{state.message}</span>
      {state.kind === "error" && state.authenticationRequired ? (
        <a href="/signin-with-chatgpt?return_to=%2Faccount">Sign in to confirm payment</a>
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
  return fallback;
}

function objectBoolean(payload: unknown, key: string): boolean {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      (payload as Record<string, unknown>)[key] === true,
  );
}
