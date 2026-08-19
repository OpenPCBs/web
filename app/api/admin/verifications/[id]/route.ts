import { eq } from "drizzle-orm";
import { requireAdminRequest } from "@/app/admin-auth";
import { readJsonObject } from "@/app/api/_lib/http";
import { getDb } from "@/db";
import {
  designs,
  revisions,
  users,
  verificationEvents,
  verificationRequests,
} from "@/db/schema";
import {
  ApiError,
  adminError,
  adminString,
  auditAdminAction,
  enumValue,
} from "../../_lib/admin-api";
import {
  serializeVerification,
  verificationSelection,
} from "../verification-fields";

const statuses = [
  "quoted",
  "payment_pending",
  "paid",
  "in_review",
  "verified",
  "failed",
  "cancelled",
] as const;

type Context = { params: Promise<{ id: string }> | { id: string } };

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireAdminRequest(request);
    const { id } = await context.params;
    const body = await readJsonObject(request);
    const status = enumValue(body.status, "status", statuses);
    const message = adminString(body.message, "message", 5_000);
    const providedBadge = adminString(body.badgeExpiresAt, "badgeExpiresAt", 100);
    if (status === undefined && message === undefined && providedBadge === undefined) {
      throw new ApiError(
        400,
        "empty_update",
        "Provide a status, event message, or badge expiry.",
      );
    }
    const badgeExpiresAt = providedBadge
      ? validIsoDate(providedBadge, "badgeExpiresAt")
      : undefined;
    const db = getDb();
    const [current] = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.id, id))
      .limit(1);
    if (!current) {
      throw new ApiError(404, "not_found", "Verification request not found.");
    }
    const nextStatus = status ?? current.status;
    const now = new Date().toISOString();
    const verifiedAt = nextStatus === "verified" ? now : null;
    const effectiveBadge =
      nextStatus === "verified"
        ? badgeExpiresAt ?? oneYearFrom(now)
        : null;

    await db
      .update(verificationRequests)
      .set({
        status: nextStatus,
        updatedAt: now,
        completedAt: ["verified", "failed", "cancelled"].includes(nextStatus)
          ? current.completedAt ?? now
          : null,
      })
      .where(eq(verificationRequests.id, id));
    await db
      .update(revisions)
      .set({
        verificationStatus: nextStatus,
        verifiedAt,
        verificationBadgeExpiresAt: effectiveBadge,
      })
      .where(eq(revisions.id, current.revisionId));

    if (nextStatus !== current.status || message || badgeExpiresAt) {
      await db.insert(verificationEvents).values({
        id: crypto.randomUUID(),
        verificationRequestId: current.id,
        actorUserId: actor.userId,
        type: "admin_status_update",
        fromStatus: current.status,
        toStatus: nextStatus,
        message: message ?? `Verification status changed to ${nextStatus}.`,
        metadataJson: JSON.stringify({ badgeExpiresAt: effectiveBadge }),
      });
    }

    const [row] = await db
      .select(verificationSelection())
      .from(verificationRequests)
      .leftJoin(users, eq(verificationRequests.userId, users.id))
      .leftJoin(designs, eq(verificationRequests.designId, designs.id))
      .leftJoin(revisions, eq(verificationRequests.revisionId, revisions.id))
      .where(eq(verificationRequests.id, id))
      .limit(1);
    const updated = serializeVerification(row);
    await auditAdminAction(db, {
      actorUserId: actor.userId,
      action: "verification.status_updated",
      entityType: "verification_request",
      entityId: id,
      before: { status: current.status },
      after: { status: nextStatus, badgeExpiresAt: effectiveBadge },
      metadata: { eventMessage: message ?? null },
    });
    return Response.json({ verification: updated });
  } catch (error) {
    return adminError(error);
  }
}

function validIsoDate(value: string, field: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "invalid_field", `${field} must be a valid date.`);
  }
  return date.toISOString();
}

function oneYearFrom(value: string): string {
  const date = new Date(value);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString();
}
