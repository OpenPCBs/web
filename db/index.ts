import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type RuntimeBindings = {
  DB?: D1Database;
  FILES?: R2Bucket;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  APP_ORIGIN?: string;
  ADMIN_EMAILS?: string;
  ADMIN_SETTINGS_ENCRYPTION_KEY?: string;
  LAB_RELEASE_REVIEW_PRICE_CENTS?: string;
  LAB_BENCH_REPRODUCTION_PRICE_CENTS?: string;
};

export function getBindings(): RuntimeBindings {
  return env as unknown as RuntimeBindings;
}

export function getDb() {
  const binding = getBindings().DB;
  if (!binding) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Configure the DB binding and apply the generated migration before using persistent APIs.",
    );
  }
  return drizzle(binding, { schema });
}

export function getOptionalDb() {
  const binding = getBindings().DB;
  return binding ? drizzle(binding, { schema }) : null;
}

export function getFilesBucket(): R2Bucket {
  const bucket = getBindings().FILES;
  if (!bucket) {
    throw new Error(
      "Cloudflare R2 binding `FILES` is unavailable. Configure the FILES binding before uploading or downloading design files.",
    );
  }
  return bucket;
}

export type Database = ReturnType<typeof getDb>;
