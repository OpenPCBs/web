import type { AuthEnvironment } from "./config";

export type AuthMessage = { to: string; url: string; kind: "verify" | "reset" };
export type AuthEmailSender = (message: AuthMessage) => Promise<void>;

/** Called only for an explicit signup, verification, or password-reset request. */
export function authEmailSender(env: AuthEnvironment): AuthEmailSender {
  return async ({ to, url, kind }) => {
    if (!env.RESEND_API_KEY || !env.AUTH_EMAIL_FROM) throw new Error("Authentication email is not configured.");
    const action = kind === "verify" ? "Verify your email" : "Set your Trace password";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.AUTH_EMAIL_FROM,
        to: [to],
        subject: `${action} — Trace`,
        text: `${action}\n\nOpen this link to continue:\n${url}\n\nThis link expires in one hour. If you did not request this, ignore this email. Never share this link with anyone.`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Authentication email could not be delivered.");
  };
}
