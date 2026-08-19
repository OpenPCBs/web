import { eq } from "drizzle-orm";
import { requireAdminRequest } from "@/app/admin-auth";
import {
  encryptAdminSetting,
  getStripeConfigurationStatus,
  secretLastFour,
} from "@/app/admin-settings";
import { readJsonObject } from "@/app/api/_lib/http";
import { getDb } from "@/db";
import { stripeSettings } from "@/db/schema";
import {
  ApiError,
  adminError,
  auditAdminAction,
} from "../../_lib/admin-api";

export async function GET(request: Request) {
  try {
    await requireAdminRequest(request);
    return Response.json({ stripe: await getStripeConfigurationStatus() });
  } catch (error) {
    return adminError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAdminRequest(request, "admin");
    const body = await readJsonObject(request);
    const secretKey = secretUpdate(body, "secretKey", /^sk_(?:test|live)_/);
    const webhookSecret = secretUpdate(body, "webhookSecret", /^whsec_/);
    const clearSecretKey = body.clearSecretKey === true;
    const clearWebhookSecret = body.clearWebhookSecret === true;
    if (body.clearSecretKey !== undefined && typeof body.clearSecretKey !== "boolean") {
      throw new ApiError(400, "invalid_field", "clearSecretKey must be a boolean.");
    }
    if (
      body.clearWebhookSecret !== undefined &&
      typeof body.clearWebhookSecret !== "boolean"
    ) {
      throw new ApiError(400, "invalid_field", "clearWebhookSecret must be a boolean.");
    }
    if (secretKey && clearSecretKey) {
      throw new ApiError(400, "invalid_field", "Do not save and clear secretKey together.");
    }
    if (webhookSecret && clearWebhookSecret) {
      throw new ApiError(
        400,
        "invalid_field",
        "Do not save and clear webhookSecret together.",
      );
    }
    if (!secretKey && !webhookSecret && !clearSecretKey && !clearWebhookSecret) {
      throw new ApiError(400, "empty_update", "No Stripe credential changes were provided.");
    }

    const db = getDb();
    const before = await getStripeConfigurationStatus(db);
    const now = new Date().toISOString();
    const secretKeyCiphertext = secretKey
      ? await encryptAdminSetting("stripe_secret_key", secretKey)
      : clearSecretKey
        ? null
        : undefined;
    const webhookSecretCiphertext = webhookSecret
      ? await encryptAdminSetting("stripe_webhook_secret", webhookSecret)
      : clearWebhookSecret
        ? null
        : undefined;
    const values = {
      ...(secretKeyCiphertext === undefined
        ? {}
        : {
            secretKeyCiphertext,
            secretKeyLast4: secretKey ? secretLastFour(secretKey) : null,
          }),
      ...(webhookSecretCiphertext === undefined
        ? {}
        : {
            webhookSecretCiphertext,
            webhookSecretLast4: webhookSecret
              ? secretLastFour(webhookSecret)
              : null,
          }),
      updatedByUserId: actor.userId,
      updatedAt: now,
    };
    const [existing] = await db
      .select()
      .from(stripeSettings)
      .where(eq(stripeSettings.id, "stripe"))
      .limit(1);
    await db
      .insert(stripeSettings)
      .values({
        id: "stripe",
        ...values,
      })
      .onConflictDoUpdate({ target: stripeSettings.id, set: values });
    const after = await getStripeConfigurationStatus(db);
    await auditAdminAction(db, {
      actorUserId: actor.userId,
      action: "settings.stripe_credentials_updated",
      entityType: "stripe_settings",
      entityId: "stripe",
      before,
      after,
      metadata: {
        replacedSecretKey: Boolean(secretKey),
        replacedWebhookSecret: Boolean(webhookSecret),
        clearedSecretKey: clearSecretKey,
        clearedWebhookSecret: clearWebhookSecret,
        hadStoredRow: Boolean(existing),
      },
    });
    return Response.json({ stripe: after });
  } catch (error) {
    return adminError(error);
  }
}

function secretUpdate(
  body: Record<string, unknown>,
  field: string,
  prefix: RegExp,
): string | undefined {
  if (!Object.hasOwn(body, field) || body[field] === "") return undefined;
  const value = body[field];
  if (
    typeof value !== "string" ||
    value.length < 20 ||
    value.length > 500 ||
    !prefix.test(value)
  ) {
    throw new ApiError(400, "invalid_field", `${field} has an invalid format.`);
  }
  return value;
}
