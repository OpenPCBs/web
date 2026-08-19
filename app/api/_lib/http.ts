import { getChatGPTUserFromRequest, type ChatGPTUser } from "@/app/chatgpt-auth";
import type { Database } from "@/db";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function requireApiUser(request: Request): ChatGPTUser {
  const user = getChatGPTUserFromRequest(request);
  if (!user) {
    throw new ApiError(
      401,
      "authentication_required",
      "Sign in with ChatGPT to use this endpoint.",
    );
  }
  return user;
}

export async function persistUser(db: Database, user: ChatGPTUser) {
  const [existing] = await db
    .select({ status: users.status })
    .from(users)
    .where(eq(users.id, user.userId))
    .limit(1);
  if (existing?.status === "suspended") {
    throw new ApiError(403, "account_suspended", "This account is suspended.");
  }
  const now = new Date().toISOString();
  await db
    .insert(users)
    .values({
      id: user.userId,
      email: user.email,
      displayName: user.displayName,
      fullName: user.fullName,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: user.email,
        displayName: user.displayName,
        fullName: user.fullName,
        updatedAt: now,
      },
    });
}

export async function requireActiveApiUser(
  request: Request,
  db: Database,
): Promise<ChatGPTUser> {
  const user = requireApiUser(request);
  await persistUser(db, user);
  return user;
}

export function handleApiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected error";
  const detail =
    error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : "";
  const combined = `${message}\n${detail}`;

  if (
    combined.includes("binding `DB`") ||
    combined.includes("no such table") ||
    combined.includes("D1_ERROR")
  ) {
    return Response.json(
      {
        error: {
          code: "storage_unavailable",
          message:
            "Persistent storage is not ready. Configure D1 and apply the generated migration.",
        },
      },
      { status: 503 },
    );
  }

  if (combined.includes("binding `FILES`")) {
    return Response.json(
      {
        error: {
          code: "file_storage_unavailable",
          message: "File storage is not ready. Configure the FILES R2 binding.",
        },
      },
      { status: 503 },
    );
  }

  console.error(error);
  return Response.json(
    { error: { code: "internal_error", message: "Unexpected server error." } },
    { status: 500 },
  );
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "invalid_body", "Request body must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

export function requiredString(
  value: unknown,
  field: string,
  maxLength = 200,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, "invalid_field", `${field} is required.`);
  }
  const result = value.trim();
  if (result.length > maxLength) {
    throw new ApiError(
      400,
      "invalid_field",
      `${field} must be ${maxLength} characters or fewer.`,
    );
  }
  return result;
}

export function optionalString(
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new ApiError(400, "invalid_field", `${field} must be text.`);
  }
  const result = value.trim();
  if (result.length > maxLength) {
    throw new ApiError(
      400,
      "invalid_field",
      `${field} must be ${maxLength} characters or fewer.`,
    );
  }
  return result;
}

export function positiveInteger(value: unknown, field: string, max: number): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > max) {
    throw new ApiError(
      400,
      "invalid_field",
      `${field} must be an integer between 1 and ${max}.`,
    );
  }
  return Number(value);
}

export function slugify(value: string): string {
  const result = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return result || `design-${crypto.randomUUID().slice(0, 8)}`;
}

export function isMissingStorageError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const detail =
    error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : "";
  return /binding `DB`|no such table|D1_ERROR/i.test(`${message}\n${detail}`);
}
