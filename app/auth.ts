import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db";
import { getAuth } from "../lib/auth/server";
import { traceIdentity, type TraceUser } from "../lib/auth/identity";
import { signInPath } from "../lib/auth/paths";
export { signInPath, signOutPath } from "../lib/auth/paths";
export type { TraceUser } from "../lib/auth/identity";

export async function getTraceUserFromHeaders(requestHeaders: Headers): Promise<TraceUser | null> {
  // Platform identity headers never establish a Trace session.
  if (!requestHeaders.get("cookie")?.includes("trace.session_token=")) return null;
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  return traceIdentity(getDb(), session);
}

export async function getTraceUserFromRequest(request: Request): Promise<TraceUser | null> {
  return getTraceUserFromHeaders(request.headers);
}

export async function getTraceUser(): Promise<TraceUser | null> {
  return getTraceUserFromHeaders(new Headers(await headers()));
}

export async function requireTraceUser(returnTo: string): Promise<TraceUser> {
  const user = await getTraceUser();
  if (user) return user;
  redirect(signInPath(returnTo));
}
