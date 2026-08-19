import { and, eq, ne } from "drizzle-orm";
import { requireAdminRequest } from "@/app/admin-auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { readJsonObject } from "@/app/api/_lib/http";
import {
  AdminIdentity,
} from "@/app/admin-auth";
import {
  ApiError,
  adminError,
  auditAdminAction,
  enumValue,
} from "../../_lib/admin-api";

const roles = ["customer", "staff", "admin"] as const;
const statuses = ["active", "suspended"] as const;

type Context = { params: Promise<{ id: string }> | { id: string } };

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireAdminRequest(request, "admin");
    const { id } = await context.params;
    const body = await readJsonObject(request);
    const role = enumValue(body.role, "role", roles);
    const status = enumValue(body.status, "status", statuses);
    if (role === undefined && status === undefined) {
      throw new ApiError(400, "empty_update", "Provide role or status to update.");
    }

    const db = getDb();
    const [current] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!current) throw new ApiError(404, "not_found", "User not found.");
    const nextRole = role ?? current.role;
    const nextStatus = status ?? current.status;

    preventSelfLockout(actor, current.id, nextRole, nextStatus);
    if (
      current.role === "admin" &&
      current.status === "active" &&
      (nextRole !== "admin" || nextStatus !== "active")
    ) {
      const another = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.role, "admin"),
            eq(users.status, "active"),
            ne(users.id, current.id),
          ),
        )
        .limit(1);
      if (!another.length) {
        throw new ApiError(
          409,
          "last_admin",
          "Promote another active administrator before changing this account.",
        );
      }
    }

    await db
      .update(users)
      .set({ role: nextRole, status: nextStatus, updatedAt: new Date().toISOString() })
      .where(eq(users.id, current.id));
    const [updated] = await db
      .select()
      .from(users)
      .where(eq(users.id, current.id))
      .limit(1);
    await auditAdminAction(db, {
      actorUserId: actor.userId,
      action: "user.access_updated",
      entityType: "user",
      entityId: current.id,
      before: { role: current.role, status: current.status },
      after: { role: updated.role, status: updated.status },
    });
    return Response.json({ user: updated });
  } catch (error) {
    return adminError(error);
  }
}

function preventSelfLockout(
  actor: AdminIdentity,
  id: string,
  role: string,
  status: string,
) {
  if (actor.userId === id && (role !== "admin" || status !== "active")) {
    throw new ApiError(
      409,
      "self_lockout",
      "You cannot remove or suspend your own administrator access.",
    );
  }
}
