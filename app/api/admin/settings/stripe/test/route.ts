import { requireAdminRequest } from "@/app/admin-auth";
import {
  getEffectiveStripeSecrets,
  getStripeConfigurationStatus,
} from "@/app/admin-settings";
import { stripeRequest } from "@/app/api/_lib/verification";
import { getDb } from "@/db";
import { stripeSettings } from "@/db/schema";
import {
  ApiError,
  adminError,
  auditAdminAction,
} from "../../../_lib/admin-api";

type StripeAccount = {
  id?: string;
  email?: string | null;
  country?: string | null;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  business_profile?: { name?: string | null } | null;
};

export async function POST(request: Request) {
  try {
    const actor = await requireAdminRequest(request, "admin");
    const db = getDb();
    const effective = await getEffectiveStripeSecrets(db);
    if (!effective.secretKey) {
      throw new ApiError(
        503,
        "stripe_not_configured",
        "Save a Stripe secret key before testing the connection.",
      );
    }
    const now = new Date().toISOString();
    try {
      const account = await stripeRequest<StripeAccount>(
        { secretKey: effective.secretKey },
        "/v1/account",
      );
      if (!account.id) {
        throw new ApiError(
          502,
          "payment_provider_error",
          "Stripe returned an invalid account response.",
        );
      }
      const message = `Connected to ${account.id}.`;
      await saveTestResult(db, actor.userId, now, "success", message);
      const stripe = await getStripeConfigurationStatus(db);
      await auditAdminAction(db, {
        actorUserId: actor.userId,
        action: "settings.stripe_connection_tested",
        entityType: "stripe_settings",
        entityId: "stripe",
        metadata: { ok: true, accountId: account.id },
      });
      return Response.json({
        ok: true,
        account: {
          id: account.id,
          email: account.email ?? null,
          country: account.country ?? null,
          chargesEnabled: Boolean(account.charges_enabled),
          payoutsEnabled: Boolean(account.payouts_enabled),
          business_profile: { name: account.business_profile?.name ?? null },
        },
        stripe,
      });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message.slice(0, 500)
          : "Stripe connection test failed.";
      await saveTestResult(db, actor.userId, now, "failed", message);
      throw error;
    }
  } catch (error) {
    return adminError(error);
  }
}

async function saveTestResult(
  db: ReturnType<typeof getDb>,
  userId: string,
  at: string,
  status: "success" | "failed",
  message: string,
) {
  const values = {
    lastTestedAt: at,
    lastTestStatus: status,
    lastTestMessage: message,
    updatedByUserId: userId,
    updatedAt: at,
  };
  await db
    .insert(stripeSettings)
    .values({ id: "stripe", ...values })
    .onConflictDoUpdate({ target: stripeSettings.id, set: values });
}
