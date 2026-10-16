import { verifyStripeSignature } from "@/lib/security/stripe-signature";
import { getDb } from "@/db";
import { getEffectiveStripeSecrets } from "@/app/admin-settings";
import {
  applyFailedProductCheckoutSession,
  applyPaidProductCheckoutSession,
  type ProductCheckoutSession,
} from "../../checkout/checkout-service";
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
  const db = getDb();
  const webhookSecret = (await getEffectiveStripeSecrets(db)).webhookSecret;
  if (!webhookSecret) {
    return Response.json(
      {
        error: "Stripe webhooks are not configured.",
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
        if (session.metadata?.verification_request_id) {
          await applyPaidStripeSession(db, session);
        }
        if (session.metadata?.order_id) {
          await applyPaidProductCheckoutSession(
            db,
            session as ProductCheckoutSession,
          );
        }
      } catch (error) {
        console.error("Unable to apply Stripe checkout event", { eventId: event.id, type: error instanceof Error ? error.name : "UnknownError" });
        return Response.json({ error: "Unable to apply event." }, { status: 500 });
      }
    }
  }
  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data?.object;
    if (session?.metadata?.order_id) {
      try {
        await applyFailedProductCheckoutSession(
          db,
          session as ProductCheckoutSession,
        );
      } catch (error) {
        console.error("Unable to apply failed Stripe checkout event", { eventId: event.id, type: error instanceof Error ? error.name : "UnknownError" });
        return Response.json({ error: "Unable to apply event." }, { status: 500 });
      }
    }
  }
  return Response.json({ received: true });
}
