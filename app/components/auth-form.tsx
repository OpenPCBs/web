"use client";

import { useState, type FormEvent } from "react";
import { safeReturnPath } from "@/lib/auth/paths";
import { site } from "@/lib/config/site";

export type AuthMode = "login" | "register" | "forgot" | "reset";
type Capabilities = { configured: boolean; email: boolean; google: boolean };
type AuthResponse = { url?: string; redirect?: boolean; error?: { message?: string }; message?: string; code?: string };

async function submitAuth(path: string, body: Record<string, unknown>): Promise<AuthResponse> {
  const response = await fetch(`/api/auth/${path}`, {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json() as AuthResponse;
  if (!response.ok) {
    if (response.status === 429) throw new Error("Too many attempts. Wait a few minutes and try again.");
    if (result.code === "EMAIL_NOT_VERIFIED") throw new Error("Verify your email before signing in. Check your inbox for a new verification link.");
    throw new Error(result.error?.message || result.message || "Unable to continue. Please try again.");
  }
  return result;
}

const headings = { login: "Welcome back", register: "Create your Trace account", forgot: "Reset your password", reset: "Choose a new password" };
const descriptions = {
  login: "Your orders, engineering designs, and verification requests in one place.",
  register: "Save your cart, manage orders, and publish your engineering work.",
  forgot: "We’ll email a link to set a new password. Existing customers can use this to set their first Trace password, too.",
  reset: "Use a unique password with at least 12 characters.",
};

export function AuthForm({ mode, capabilities, returnTo, token, error }: {
  mode: AuthMode; capabilities: Capabilities; returnTo: string; token?: string; error?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState(error ? "That sign-in or recovery link could not be completed. Please try again." : "");
  const [terms, setTerms] = useState(false);
  const destination = safeReturnPath(returnTo);
  const entry = mode === "login" || mode === "register";
  const hasPassword = mode !== "forgot";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(""); setMessage(""); setBusy(true);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    try {
      if (mode === "login") {
        await submitAuth("sign-in/email", { email, password, callbackURL: destination, rememberMe: false });
        window.location.assign(destination);
      } else if (mode === "register") {
        await submitAuth("sign-up/email", { name: String(data.get("name") || "").trim(), email, password, acceptTerms: terms, termsVersion: site.policyVersion, callbackURL: "/login?verified=1" });
        setMessage("Check your inbox for a verification link. If you already have an account, sign in or reset your password.");
      } else if (mode === "forgot") {
        await submitAuth("request-password-reset", { email, redirectTo: "/reset-password" });
        setMessage("If an account exists for that email, a password reset link will arrive shortly.");
      } else {
        if (!token) throw new Error("This reset link is incomplete. Request a new one.");
        await submitAuth("reset-password", { token, newPassword: password });
        setMessage("Your password has been saved and other sessions have been signed out. You can now sign in.");
      }
    } catch (cause) { setFailure(cause instanceof Error ? cause.message : "Unable to continue."); }
    finally { setBusy(false); }
  }

  async function googleSignIn() {
    setFailure(""); setBusy(true);
    try {
      const result = await submitAuth("sign-in/social", { provider: "google", callbackURL: destination, errorCallbackURL: "/login?error=google" });
      const url = new URL(result.url || "");
      if (url.origin !== "https://accounts.google.com" || url.username || url.password) throw new Error("Unable to start Google sign-in.");
      window.location.assign(url.href);
    } catch (cause) { setFailure(cause instanceof Error ? cause.message : "Unable to start Google sign-in."); setBusy(false); }
  }

  return <section className="auth-card" aria-labelledby="auth-heading">
    <a className="auth-wordmark" href="/" aria-label="Trace home"><span>T</span> TRACE</a>
    <p className="auth-eyebrow">YOUR ENGINEERING WORKSPACE</p>
    <h1 id="auth-heading">{headings[mode]}</h1>
    <p className="auth-intro">{descriptions[mode]}</p>
    {entry && <>
      <button className="auth-google" type="button" onClick={() => void googleSignIn()} disabled={busy || !capabilities.google}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.87 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>Continue with Google
      </button>
      {!capabilities.google && <p className="auth-hint">Google sign-in is temporarily unavailable.</p>}
      <div className="auth-divider"><span>or use your email</span></div>
    </>}
    <form onSubmit={(event) => void handleSubmit(event)} className="auth-form">
      {mode === "register" && <label htmlFor="auth-name">Full name<input id="auth-name" name="name" autoComplete="name" required maxLength={120} disabled={busy} /></label>}
      {mode !== "reset" && <label htmlFor="auth-email">Email address<input id="auth-email" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254} disabled={busy} /></label>}
      {hasPassword && <label htmlFor="auth-password">{mode === "reset" ? "New password" : "Password"}<input id="auth-password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 12} maxLength={128} disabled={busy} aria-describedby={mode === "login" ? undefined : "auth-password-help"} /></label>}
      {hasPassword && mode !== "login" && <p id="auth-password-help" className="auth-hint">At least 12 characters. A password manager can generate and save a strong password.</p>}
      {mode === "register" && <label className="auth-checkbox" htmlFor="auth-terms"><input id="auth-terms" type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} required /> <span>I accept the <a href="/legal/terms" target="_blank" rel="noreferrer">Terms of Use</a> and have read the <a href="/legal/privacy" target="_blank" rel="noreferrer">Privacy Notice</a>.</span></label>}
      {mode === "login" && <a className="auth-forgot" href="/forgot-password">Forgot password or signing in for the first time?</a>}
      {failure && <p className="auth-error" role="alert">{failure}</p>}
      {message && <p className="auth-success" role="status">{message}</p>}
      <button className="auth-submit" type="submit" disabled={busy || !capabilities.email || (mode === "reset" && !token)}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : "Save new password"}</button>
      {!capabilities.email && <p className="auth-hint">Email sign-in is temporarily unavailable. Please try again later.</p>}
    </form>
    <p className="auth-switch">{mode === "login" ? <>New to Trace? <a href={`/register?return_to=${encodeURIComponent(destination)}`}>Create an account</a></> : <>Already have an account? <a href={`/login?return_to=${encodeURIComponent(destination)}`}>Sign in</a></>}</p>
    <p className="auth-privacy">By continuing with Google, you accept the <a href="/legal/terms">Terms of Use</a>. Google shares basic profile information only when you choose it. <a href="/legal/privacy">Privacy notice</a></p>
  </section>;
}

export function SignOutButton({ returnTo = "/", children = "Sign out" }: { returnTo?: string; children?: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <><button type="button" className="auth-signout" disabled={busy} onClick={async () => {
    setBusy(true); setError("");
    try { await submitAuth("sign-out", {}); window.location.assign(safeReturnPath(returnTo, "/")); }
    catch { setError("Could not sign out. Please try again."); setBusy(false); }
  }}>{busy ? "Signing out…" : children}</button>{error && <p role="alert">{error}</p>}</>;
}
