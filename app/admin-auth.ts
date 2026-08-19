import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  chatGPTSignInPath,
  getChatGPTUser,
  getChatGPTUserFromRequest,
  type ChatGPTUser,
} from "@/app/chatgpt-auth";
import { getBindings, getDb, type Database } from "@/db";
import { users } from "@/db/schema";
import { ApiError } from "@/app/api/_lib/http";

export type AdminIdentity = {
  userId: string;
  email: string;
  displayName: string;
  fullName: string | null;
  role: "staff" | "admin";
  status: "active";
  bootstrap: boolean;
};

type AdminLevel = "staff" | "admin";

export async function requireAdminUser(returnTo = "/admin"): Promise<AdminIdentity> {
  const user = await getChatGPTUser();
  if (!user) redirect(chatGPTSignInPath(returnTo));
  try {
    return await resolveAdminIdentity(getDb(), user, "staff");
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      redirect("/?admin=forbidden");
    }
    throw error;
  }
}

export async function requireAdminRequest(
  request: Request,
  level: AdminLevel = "staff",
): Promise<AdminIdentity> {
  const user = getChatGPTUserFromRequest(request);
  if (!user) {
    throw new ApiError(401, "authentication_required", "Sign in to access admin APIs.");
  }
  return resolveAdminIdentity(getDb(), user, level);
}

async function resolveAdminIdentity(
  db: Database,
  user: ChatGPTUser,
  level: AdminLevel,
): Promise<AdminIdentity> {
  const bootstrap = bootstrapEmails().has(user.email.toLowerCase());
  let [record] = await db
    .select()
    .from(users)
    .where(eq(users.id, user.userId))
    .limit(1);
  const now = new Date().toISOString();

  if (!record) {
    await db.insert(users).values({
      id: user.userId,
      email: user.email,
      displayName: user.displayName,
      fullName: user.fullName,
      role: bootstrap ? "admin" : "customer",
      status: "active",
      lastSeenAt: now,
      updatedAt: now,
    });
    [record] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1);
  } else {
    if (record.status === "suspended") {
      throw new ApiError(403, "account_suspended", "This account is suspended.");
    }
    const nextRole = bootstrap && record.role === "customer" ? "admin" : record.role;
    await db
      .update(users)
      .set({
        email: user.email,
        displayName: user.displayName,
        fullName: user.fullName,
        role: nextRole,
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, user.userId));
    record = { ...record, role: nextRole, email: user.email, displayName: user.displayName, fullName: user.fullName, lastSeenAt: now, updatedAt: now };
  }

  if (!record || (record.role !== "staff" && record.role !== "admin")) {
    throw new ApiError(403, "admin_required", "An administrator role is required.");
  }
  if (level === "admin" && record.role !== "admin") {
    throw new ApiError(403, "owner_admin_required", "An admin role is required for this action.");
  }

  return {
    userId: record.id,
    email: record.email,
    displayName: record.displayName,
    fullName: record.fullName,
    role: record.role,
    status: "active",
    bootstrap,
  };
}

function bootstrapEmails(): Set<string> {
  const value = (getBindings() as unknown as { ADMIN_EMAILS?: string }).ADMIN_EMAILS ?? "";
  return new Set(
    value
      .split(/[;,\n]/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}
