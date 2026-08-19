import { requireAdminRequest } from "@/app/admin-auth";
import {
  encryptAdminSetting,
  getAppOrigin,
  getEffectiveStripeSecrets,
  getStripeConfigurationStatus,
  secretLastFour,
} from "@/app/admin-settings";
import { stripeRequest } from "@/app/api/_lib/verification";
import { getDb } from "@/db";
import { stripeSettings } from "@/db/schema";
import {
  ApiError,
  adminError,
  auditAdminAction,
} from "../../../_lib/admin-api";

const enabledEvents = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
] as const;

type StripeWebhookEndpoint = {
  id: string;
  url: string;
  status?: string;
  enabled_events?: string[];
  secret?: string;
};
type StripeWebhookList = { data?: StripeWebhookEndpoint[] };

export async function POST(request: Request) {
  try {
    const actor = await requireAdminRequest(request, "admin");
    const db = getDb();
    const origin = await getAppOrigin(db);
    if (!origin) {
      throw new ApiError(
        503,
        "origin_not_configured",
        "Save a valid public site origin before configuring a Stripe webhook.",
      );
    }
    const effective = await getEffectiveStripeSecrets(db);
    if (!effective.secretKey) {
      throw new ApiError(
        503,
        "stripe_not_configured",
        "Save a Stripe secret key before configuring a webhook.",
      );
    }
    const configuration = await getStripeConfigurationStatus(db);
    const webhookUrl = `${origin}/api/stripe/webhook`;
    const list = await stripeRequest<StripeWebhookList>(
      { secretKey: effective.secretKey },
      "/v1/webhook_endpoints?limit=100",
    );
    const existing = list.data?.find((endpoint) => endpoint.url === webhookUrl);
    let endpoint: StripeWebhookEndpoint;
    let encryptedSecret: string | undefined;
    let reused = Boolean(existing);

    if (existing) {
      if (!effective.webhookSecret) {
        throw new ApiError(
          409,
          "existing_webhook_secret_unavailable",
          "A Stripe webhook already uses this URL, but Stripe cannot reveal its signing secret again. Paste that endpoint's whsec_ secret manually, or remove it in Stripe and retry automatic setup.",
        );
      }
      const form = eventForm();
      form.set("url", webhookUrl);
      form.set("description", "Thevenin checkout and verification reconciliation");
      endpoint = await stripeRequest<StripeWebhookEndpoint>(
        { secretKey: effective.secretKey },
        `/v1/webhook_endpoints/${encodeURIComponent(existing.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form,
        },
      );
    } else {
      if (!configuration.encryptionKeyConfigured) {
        throw new ApiError(
          503,
          "encryption_key_missing",
          "Set ADMIN_SETTINGS_ENCRYPTION_KEY before automatically creating a webhook.",
        );
      }
      const form = eventForm();
      form.set("url", webhookUrl);
      form.set("description", "Thevenin checkout and verification reconciliation");
      endpoint = await stripeRequest<StripeWebhookEndpoint>(
        { secretKey: effective.secretKey },
        "/v1/webhook_endpoints",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form,
        },
      );
      if (!endpoint.secret) {
        throw new ApiError(
          502,
          "payment_provider_error",
          "Stripe created the webhook without returning its signing secret.",
        );
      }
      encryptedSecret = await encryptAdminSetting(
        "stripe_webhook_secret",
        endpoint.secret,
      );
      reused = false;
    }
    if (!endpoint.id || endpoint.url !== webhookUrl) {
      throw new ApiError(
        502,
        "payment_provider_error",
        "Stripe returned an invalid webhook endpoint.",
      );
    }
    const now = new Date().toISOString();
    const values = {
      webhookEndpointId: endpoint.id,
      webhookEndpointUrl: endpoint.url,
      ...(encryptedSecret
        ? {
            webhookSecretCiphertext: encryptedSecret,
            webhookSecretLast4: secretLastFour(endpoint.secret!),
          }
        : {}),
      updatedByUserId: actor.userId,
      updatedAt: now,
    };
    await db
      .insert(stripeSettings)
      .values({ id: "stripe", ...values })
      .onConflictDoUpdate({ target: stripeSettings.id, set: values });
    const stripe = await getStripeConfigurationStatus(db);
    await auditAdminAction(db, {
      actorUserId: actor.userId,
      action: reused
        ? "settings.stripe_webhook_reused"
        : "settings.stripe_webhook_created",
      entityType: "stripe_settings",
      entityId: "stripe",
      metadata: {
        endpointId: endpoint.id,
        url: endpoint.url,
        enabledEvents,
      },
    });
    return Response.json({
      webhook: {
        configured: true,
        endpointId: endpoint.id,
        url: endpoint.url,
        enabledEvents: [...enabledEvents],
        reused,
      },
      stripe,
    });
  } catch (error) {
    return adminError(error);
  }
}

function eventForm() {
  const form = new URLSearchParams();
  for (const event of enabledEvents) form.append("enabled_events[]", event);
  return form;
}
