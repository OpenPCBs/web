import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { eq, sql } from "drizzle-orm";
import type { Database } from "../../db";
import { authUser, authSession, authAccount, authVerification } from "../../db/auth-schema";
import { requestRateLimits, users } from "../../db/schema";
import { authCapabilities, validAuthOrigin, type AuthEnvironment } from "./config";
import { authEmailSender, type AuthEmailSender } from "./email";
import { site } from "../config/site";

/** A request-scoped instance; never caches database bindings across Workers. */
export function createTraceAuth(db: Database, env: AuthEnvironment, sendEmail: AuthEmailSender = authEmailSender(env)) {
  const origin = validAuthOrigin(env.AUTH_ORIGIN);
  const capabilities = authCapabilities(env);
  if (!origin || !capabilities.configured) throw new Error("Trace authentication is not configured.");
  return betterAuth({
    appName: "Trace",
    baseURL: origin,
    basePath: "/api/auth",
    secret: env.AUTH_SECRET!,
    trustedOrigins: [origin],
    database: drizzleAdapter(db, {
      provider: "sqlite",
      transaction: false,
      schema: { user: authUser, session: authSession, account: authAccount, verification: authVerification },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 3600,
      sendResetPassword: async ({ user, url }) => sendEmail({ to: user.email, url, kind: "reset" }),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) => sendEmail({ to: user.email, url, kind: "verify" }),
    },
    socialProviders: capabilities.google ? {
      google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET!, requireEmailVerification: true },
    } : {},
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    account: {
      encryptOAuthTokens: true,
      storeStateStrategy: "database",
      accountLinking: { enabled: true, requireLocalEmailVerified: true, trustedProviders: [], allowDifferentEmails: false },
    },
    advanced: {
      useSecureCookies: true,
      cookiePrefix: "trace",
      defaultCookieAttributes: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        "/request-password-reset": { window: 300, max: 3 },
        "/send-verification-email": { window: 300, max: 3 },
      },
      customStorage: {
        async consume(key, rule) {
          const window = Math.floor(Date.now() / (rule.window * 1000));
          const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`auth:${window}:${rule.window}:${key}`));
          const id = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
          const [row] = await db.insert(requestRateLimits).values({ key: id, count: 1, expiresAt: (window + 2) * rule.window })
            .onConflictDoUpdate({ target: requestRateLimits.key, set: { count: sql`${requestRateLimits.count} + 1` } }).returning({ count: requestRateLimits.count });
          await db.run(sql`DELETE FROM request_rate_limits WHERE key IN (SELECT key FROM request_rate_limits WHERE expires_at < ${Math.floor(Date.now() / 1000)} LIMIT 100)`);
          return { allowed: Boolean(row && row.count <= rule.max), retryAfter: row && row.count <= rule.max ? null : rule.window };
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (["/sign-up/email", "/sign-in/email", "/request-password-reset", "/send-verification-email"].includes(ctx.path) && !capabilities.email) {
          throw new APIError("SERVICE_UNAVAILABLE", { message: "Email sign-in is temporarily unavailable. Please try again later." });
        }
        if (ctx.path === "/sign-up/email" && (ctx.body?.acceptTerms !== true || ctx.body?.termsVersion !== site.policyVersion)) {
          throw new APIError("BAD_REQUEST", { message: "Accept the current Terms of Use and Privacy Notice to create an account." });
        }
      }),
    },
    databaseHooks: {
      session: { create: { before: async (session) => {
        const [record] = await db.select({ status: users.status }).from(users).where(eq(users.id, session.userId)).limit(1);
        if (record?.status === "suspended") throw new APIError("FORBIDDEN", { message: "This account is unavailable. Contact support." });
        return { data: session };
      } } },
    },
    // No public account deletion/linking/token APIs without a separate reviewed UI.
    disabledPaths: ["/delete-user", "/delete-user/callback", "/change-email", "/link-social", "/unlink-account", "/get-access-token", "/refresh-token"],
    logger: { disabled: true },
    telemetry: { enabled: false },
    onAPIError: { errorURL: `${origin}/login?error=auth` },
  });
}
