import { and, desc, eq, like, or } from "drizzle-orm";
import { requireAdminRequest } from "@/app/admin-auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { adminError, enumValue, parseLimit } from "../_lib/admin-api";

const roles = ["customer", "staff", "admin"] as const;
const statuses = ["active", "suspended"] as const;

export async function GET(request: Request) {
  try {
    await requireAdminRequest(request);
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim().slice(0, 160);
    const role = enumValue(url.searchParams.get("role") ?? undefined, "role", roles);
    const status = enumValue(
      url.searchParams.get("status") ?? undefined,
      "status",
      statuses,
    );
    const conditions = [];
    if (query) {
      conditions.push(
        or(
          like(users.email, `%${query}%`),
          like(users.displayName, `%${query}%`),
          like(users.fullName, `%${query}%`),
        )!,
      );
    }
    if (role) conditions.push(eq(users.role, role));
    if (status) conditions.push(eq(users.status, status));

    const rows = await getDb()
      .select()
      .from(users)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(parseLimit(url));
    return Response.json({ users: rows });
  } catch (error) {
    return adminError(error);
  }
}
