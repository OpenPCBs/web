import { eq } from "drizzle-orm";
import { getBindings, getDb, type Database } from "@/db";
import { storeSettings, stripeSettings } from "@/db/schema";
import { ApiError, isMissingStorageError } from "@/app/api/_lib/http";

type SettingsBindings = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  ADMIN_SETTINGS_ENCRYPTION_KEY?: string;
  APP_ORIGIN?: string;
};

export type StripeSecretSource = "stored" | "environment" | "none";

export async function getEffectiveStripeSecrets(db: Database = getDb()) {
  const env = settingsBindings();
  let row: typeof stripeSettings.$inferSelect | undefined;
  try {
    [row] = await db
      .select()
      .from(stripeSettings)
      .where(eq(stripeSettings.id, "stripe"))
      .limit(1);
  } catch (error) {
    if (!isMissingStorageError(error)) throw error;
  }

  let storedSecret: string | undefined;
  let storedWebhook: string | undefined;
  if (row?.secretKeyCiphertext) {
    storedSecret = await tryDecrypt("stripe_secret_key", row.secretKeyCiphertext);
  }
  if (row?.webhookSecretCiphertext) {
    storedWebhook = await tryDecrypt("stripe_webhook_secret", row.webhookSecretCiphertext);
  }
  const envSecret = env.STRIPE_SECRET_KEY?.trim() || undefined;
  const envWebhook = env.STRIPE_WEBHOOK_SECRET?.trim() || undefined;

  return {
    secretKey: storedSecret ?? envSecret,
    webhookSecret: storedWebhook ?? envWebhook,
    secretKeySource: (storedSecret ? "stored" : envSecret ? "environment" : "none") as StripeSecretSource,
    webhookSecretSource: (storedWebhook ? "stored" : envWebhook ? "environment" : "none") as StripeSecretSource,
    row,
  };
}

export async function getStripeConfigurationStatus(db: Database = getDb()) {
  const effective = await getEffectiveStripeSecrets(db);
  const origin = await getAppOrigin(db);
  const store = await getStoreConfiguration(db);
  return {
    secretKeyConfigured: Boolean(effective.secretKey),
    webhookSecretConfigured: Boolean(effective.webhookSecret),
    secretKeySource: effective.secretKeySource,
    webhookSecretSource: effective.webhookSecretSource,
    secretKeyLast4:
      effective.row?.secretKeyLast4 ?? lastFour(settingsBindings().STRIPE_SECRET_KEY),
    webhookSecretLast4:
      effective.row?.webhookSecretLast4 ?? lastFour(settingsBindings().STRIPE_WEBHOOK_SECRET),
    checkoutReady: Boolean(effective.secretKey && origin && store.checkoutEnabled),
    webhookReady: Boolean(effective.webhookSecret),
    originConfigured: Boolean(origin),
    encryptionKeyConfigured: Boolean(settingsBindings().ADMIN_SETTINGS_ENCRYPTION_KEY?.trim()),
    webhookEndpointId: effective.row?.webhookEndpointId ?? null,
    webhookEndpointUrl: effective.row?.webhookEndpointUrl ?? null,
    lastTestedAt: effective.row?.lastTestedAt ?? null,
    lastTestStatus: effective.row?.lastTestStatus ?? null,
    lastTestMessage: effective.row?.lastTestMessage ?? null,
  };
}

export async function getStoreConfiguration(db: Database = getDb()) {
  try {
    const [row] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.id, "store"))
      .limit(1);
    return (
      row ?? {
        id: "store",
        storeName: "Thevenin Supply",
        supportEmail: "",
        currency: "usd",
        publicOrigin: null,
        allowedShippingCountriesJson: '["US"]',
        flatShippingCents: 0,
        automaticTaxEnabled: false,
        checkoutEnabled: true,
        updatedByUserId: null,
        createdAt: null,
        updatedAt: null,
      }
    );
  } catch (error) {
    if (!isMissingStorageError(error)) throw error;
    return {
      id: "store",
      storeName: "Thevenin Supply",
      supportEmail: "",
      currency: "usd",
      publicOrigin: null,
      allowedShippingCountriesJson: '["US"]',
      flatShippingCents: 0,
      automaticTaxEnabled: false,
      checkoutEnabled: true,
      updatedByUserId: null,
      createdAt: null,
      updatedAt: null,
    };
  }
}

export async function getAppOrigin(db: Database = getDb()): Promise<string | undefined> {
  const store = await getStoreConfiguration(db);
  const configured = store.publicOrigin?.trim() || settingsBindings().APP_ORIGIN?.trim();
  if (!configured) return undefined;
  try {
    const url = new URL(configured);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export async function encryptAdminSetting(name: string, plaintext: string): Promise<string> {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(name) },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptAdminSetting(name: string, payload: string): Promise<string> {
  const [version, ivValue, ciphertextValue] = payload.split(".");
  if (version !== "v1" || !ivValue || !ciphertextValue) {
    throw new ApiError(500, "invalid_encrypted_setting", "Stored integration settings are invalid.");
  }
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: fromBase64Url(ivValue),
        additionalData: new TextEncoder().encode(name),
      },
      await encryptionKey(),
      fromBase64Url(ciphertextValue),
    );
    return new TextDecoder().decode(plaintext);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      503,
      "settings_decryption_failed",
      "Stored integration settings could not be decrypted with ADMIN_SETTINGS_ENCRYPTION_KEY.",
    );
  }
}

export function secretLastFour(value: string): string {
  return value.slice(-4);
}

function settingsBindings(): SettingsBindings {
  return getBindings() as unknown as SettingsBindings;
}

async function encryptionKey(): Promise<CryptoKey> {
  const secret = settingsBindings().ADMIN_SETTINGS_ENCRYPTION_KEY?.trim();
  if (!secret) {
    throw new ApiError(
      503,
      "encryption_key_missing",
      "Set ADMIN_SETTINGS_ENCRYPTION_KEY before saving secrets in admin settings.",
    );
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    Uint8Array.from(new TextEncoder().encode(secret)),
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function tryDecrypt(name: string, payload: string): Promise<string | undefined> {
  try {
    return await decryptAdminSetting(name, payload);
  } catch (error) {
    if (
      error instanceof ApiError &&
      ["encryption_key_missing", "settings_decryption_failed"].includes(error.code)
    ) {
      return undefined;
    }
    throw error;
  }
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function lastFour(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.slice(-4) : null;
}
