import { adminAuditEvents } from "@/db/schema";
import type { Database } from "@/db";
import { ApiError, handleApiError } from "@/app/api/_lib/http";

export { ApiError };

export function adminError(error: unknown): Response {
  return handleApiError(error);
}

export async function auditAdminAction(
  db: Database,
  input: {
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    metadata?: unknown;
  },
) {
  await db.insert(adminAuditEvents).values({
    id: crypto.randomUUID(),
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeJson: safeJson(input.before),
    afterJson: safeJson(input.after),
    metadataJson: safeJson(input.metadata),
  });
}

export function adminString(
  value: unknown,
  field: string,
  maxLength: number,
  required = false,
): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (required) throw new ApiError(400, "invalid_field", `${field} is required.`);
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ApiError(400, "invalid_field", `${field} must be text.`);
  }
  const result = value.trim();
  if ((required && !result) || result.length > maxLength) {
    throw new ApiError(400, "invalid_field", `${field} is invalid.`);
  }
  return result;
}

export function adminInteger(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new ApiError(
      400,
      "invalid_field",
      `${field} must be an integer between ${min} and ${max}.`,
    );
  }
  return Number(value);
}

export function adminBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new ApiError(400, "invalid_field", `${field} must be true or false.`);
  }
  return value;
}

export function enumValue<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ApiError(400, "invalid_field", `${field} is invalid.`);
  }
  return value as T;
}

export function parseLimit(url: URL, fallback = 100, max = 250): number {
  const value = Number(url.searchParams.get("limit") ?? fallback);
  return Number.isInteger(value) && value >= 1 && value <= max ? value : fallback;
}

function safeJson(value: unknown): string | null {
  if (value === undefined) return null;
  return JSON.stringify(value).slice(0, 50_000);
}
