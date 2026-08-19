import { and, desc, eq, like, or } from "drizzle-orm";
import { requireAdminRequest } from "@/app/admin-auth";
import { getDb } from "@/db";
import { designs, revisions, users, verificationRequests } from "@/db/schema";
import { adminError, enumValue, parseLimit } from "../_lib/admin-api";
import { serializeVerification, verificationSelection } from "./verification-fields";

const statuses = [
  "quoted",
  "payment_pending",
  "paid",
  "in_review",
  "verified",
  "failed",
  "cancelled",
] as const;

export async function GET(request: Request) {
  try {
    await requireAdminRequest(request);
    const url = new URL(request.url);
    const status = enumValue(
      url.searchParams.get("status") ?? undefined,
      "status",
      statuses,
    );
    const query = url.searchParams.get("q")?.trim().slice(0, 160);
    const conditions = [];
    if (status) conditions.push(eq(verificationRequests.status, status));
    if (query) {
      conditions.push(
        or(
          like(verificationRequests.id, `%${query}%`),
          like(users.email, `%${query}%`),
          like(users.displayName, `%${query}%`),
          like(designs.title, `%${query}%`),
          like(revisions.version, `%${query}%`),
        )!,
      );
    }
    const rows = await getDb()
      .select(verificationSelection())
      .from(verificationRequests)
      .leftJoin(users, eq(verificationRequests.userId, users.id))
      .leftJoin(designs, eq(verificationRequests.designId, designs.id))
      .leftJoin(revisions, eq(verificationRequests.revisionId, revisions.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(verificationRequests.createdAt))
      .limit(parseLimit(url));
    return Response.json({ verifications: rows.map(serializeVerification) });
  } catch (error) {
    return adminError(error);
  }
}
