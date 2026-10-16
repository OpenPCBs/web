import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getBindings } from "@/db";
import { getAuthCapabilities } from "@/lib/auth/server";
import { validAuthOrigin } from "@/lib/auth/config";
import { safeReturnPath } from "@/lib/auth/paths";
import { SiteFooter, SiteHeader } from "./site-shell";
import { AuthForm, type AuthMode } from "./auth-form";
import "../auth.css";

export type AuthSearchParams = Promise<Record<string, string | string[] | undefined>>;
export async function AuthPage({ mode, searchParams }: { mode: AuthMode; searchParams: AuthSearchParams }) {
  const params = await searchParams;
  const first = (key: string) => typeof params[key] === "string" ? params[key] as string : undefined;
  const returnTo = safeReturnPath(first("return_to"));
  const token = first("token")?.slice(0, 2000);
  const path = { login: "/login", register: "/register", forgot: "/forgot-password", reset: "/reset-password" }[mode];
  const origin = validAuthOrigin(getBindings().AUTH_ORIGIN);
  const host = (await headers()).get("host");
  if (origin && host && host !== new URL(origin).host) {
    const destination = new URL(path, origin);
    destination.searchParams.set("return_to", returnTo);
    if (token) destination.searchParams.set("token", token);
    if (first("error")) destination.searchParams.set("error", "auth");
    redirect(destination.href);
  }
  return <><SiteHeader active="account" /><main id="main-content" className="auth-layout" tabIndex={-1}><AuthForm mode={mode} capabilities={getAuthCapabilities()} returnTo={returnTo} token={token} error={first("error")} /></main><SiteFooter /></>;
}
