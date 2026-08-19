import { eq } from "drizzle-orm";
import { requireAdminRequest } from "@/app/admin-auth";
import { readJsonObject } from "@/app/api/_lib/http";
import { getDb } from "@/db";
import { inquiries, users } from "@/db/schema";
import {
  ApiError,
  adminError,
  auditAdminAction,
  enumValue,
} from "../../_lib/admin-api";
import { serializeInquiry } from "../inquiry-fields";

const statuses = ["new", "in_progress", "resolved", "closed"] as const;
type Context = { params: Promise<{ id: string }> | { id: string } };

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireAdminRequest(request);
    const { id } = await context.params;
    const body = await readJsonObject(request);
    const status = enumValue(body.status, "status", statuses);
    const notes = stringUpdate(body, "notes", 10_000);
    const assignedToUserId = nullableStringUpdate(body, "assignedToUserId", 100);
    if (status === undefined && notes === undefined && assignedToUserId === undefined) {
      throw new ApiError(400, "empty_update", "No supported inquiry changes were provided.");
    }
    const db = getDb();
    const [current] = await db
      .select()
      .from(inquiries)
      .where(eq(inquiries.id, id))
      .limit(1);
    if (!current) throw new ApiError(404, "not_found", "Inquiry not found.");
    if (assignedToUserId) {
      const [assignee] = await db
        .select({ role: users.role, status: users.status })
        .from(users)
        .where(eq(users.id, assignedToUserId))
        .limit(1);
      if (
        !assignee ||
        assignee.status !== "active" ||
        !["staff", "admin"].includes(assignee.role)
      ) {
        throw new ApiError(400, "invalid_assignee", "Assignee must be active staff.");
      }
    }
    const nextStatus = status ?? current.status;
    const now = new Date().toISOString();
    await db
      .update(inquiries)
      .set({
        ...(status === undefined ? {} : { status }),
        ...(notes === undefined ? {} : { adminNotes: notes }),
        ...(assignedToUserId === undefined ? {} : { assignedToUserId }),
        resolvedAt: ["resolved", "closed"].includes(nextStatus)
          ? current.resolvedAt ?? now
          : null,
        updatedAt: now,
      })
      .where(eq(inquiries.id, id));
    const [updatedRow] = await db
      .select()
      .from(inquiries)
      .where(eq(inquiries.id, id))
      .limit(1);
    const updated = serializeInquiry(updatedRow);
    await auditAdminAction(db, {
      actorUserId: actor.userId,
      action: "inquiry.updated",
      entityType: "inquiry",
      entityId: id,
      before: current,
      after: updated,
    });
    return Response.json({ inquiry: updated });
  } catch (error) {
    return adminError(error);
  }
}

function stringUpdate(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
): string | undefined {
  if (!Object.hasOwn(body, field)) return undefined;
  const value = body[field];
  if (typeof value !== "string" || value.length > maxLength) {
    throw new ApiError(400, "invalid_field", `${field} is invalid.`);
  }
  return value.trim();
}

function nullableStringUpdate(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
): string | null | undefined {
  if (!Object.hasOwn(body, field)) return undefined;
  const value = body[field];
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new ApiError(400, "invalid_field", `${field} is invalid.`);
  }
  return value.trim();
}
