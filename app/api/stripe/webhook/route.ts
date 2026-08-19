import { getBindings, getDb } from "@/db";
import {
  applyPaidStripeSession,
  type StripeCheckoutSession,
} from "../../_lib/verification";

type StripeEvent = {
  id?: string;
  type?: string;
  data?: { object?: StripeCheckoutSession };
};

export async function POST(request: Request) {
  const webhookSecret = getBindings().STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return Response.json(
      {
        error: "Stripe webhooks are not configured. Set STRIPE_WEBHOOK_SECRET.",
        code: "webhook_not_configured",
      },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();
  if (!signature || !(await verifyStripeSignature(payload, signature, webhookSecret))) {
    return Response.json(
      { error: "Invalid Stripe webhook signature." },
      { status: 400 },
    );
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return Response.json({ error: "Invalid webhook JSON." }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data?.object;
    if (session) {
      try {
        await applyPaidStripeSession(getDb(), session);
      } catch (error) {
        console.error("Unable to apply Stripe checkout event", event.id, error);
        return Response.json({ error: "Unable to apply event." }, { status: 500 });
      }
    }
  }
  return Response.json({ received: true });
}

async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
): Promise<boolean> {
  const parts = header.split(",").map((part) => part.trim().split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts
    .filter(([key]) => key === "v1")
    .map(([, value]) => value?.toLowerCase())
    .filter((value): value is string => Boolean(value));
  const timestampNumber = Number(timestamp);
  if (
    !timestamp ||
    !Number.isFinite(timestampNumber) ||
    Math.abs(Date.now() / 1000 - timestampNumber) > 300 ||
    signatures.length === 0
  ) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  const expected = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return signatures.some((candidate) => timingSafeEqual(candidate, expected));
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
