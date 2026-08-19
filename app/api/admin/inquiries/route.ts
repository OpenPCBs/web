import { and, desc, eq, like, or } from "drizzle-orm";
import { requireAdminRequest } from "@/app/admin-auth";
import { getDb } from "@/db";
import { inquiries } from "@/db/schema";
import { adminError, enumValue, parseLimit } from "../_lib/admin-api";
import { serializeInquiry } from "./inquiry-fields";

const types = ["support", "quote", "sourcing", "license"] as const;
const statuses = ["new", "in_progress", "resolved", "closed"] as const;

export async function GET(request: Request) {
  try {
    await requireAdminRequest(request);
    const url = new URL(request.url);
    const type = enumValue(url.searchParams.get("type") ?? undefined, "type", types);
    const status = enumValue(
      url.searchParams.get("status") ?? undefined,
      "status",
      statuses,
    );
    const query = url.searchParams.get("q")?.trim().slice(0, 160);
    const conditions = [];
    if (type) conditions.push(eq(inquiries.type, type));
    if (status) conditions.push(eq(inquiries.status, status));
    if (query) {
      conditions.push(
        or(
          like(inquiries.id, `%${query}%`),
          like(inquiries.name, `%${query}%`),
          like(inquiries.email, `%${query}%`),
          like(inquiries.company, `%${query}%`),
          like(inquiries.subject, `%${query}%`),
          like(inquiries.message, `%${query}%`),
        )!,
      );
    }
    const rows = await getDb()
      .select()
      .from(inquiries)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(inquiries.createdAt))
      .limit(parseLimit(url));
    return Response.json({ inquiries: rows.map(serializeInquiry) });
  } catch (error) {
    return adminError(error);
  }
}
