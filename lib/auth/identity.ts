import { eq } from "drizzle-orm";
import type { Database } from "../../db";
import { users } from "../../db/schema";

export type TraceUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  emailVerified: true;
};

type VerifiedSession = { user: { id: string; name: string; email: string; emailVerified: boolean } } | null;

/** Only call with a session verified by Better Auth, never with browser input. */
export async function traceIdentity(db: Database, session: VerifiedSession): Promise<TraceUser | null> {
  if (!session?.user.emailVerified) return null;
  const [record] = await db.select({ status: users.status }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (record?.status === "suspended") return null;
  return {
    userId: session.user.id,
    displayName: session.user.name || session.user.email,
    email: session.user.email.toLowerCase(),
    fullName: session.user.name || null,
    emailVerified: true,
  };
}
