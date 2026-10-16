import { ApiError } from "../http/api-error";

/** Persistent fixed-window counters shared across Worker instances. */
export async function enforceRateLimit(request: Request, db: D1Database): Promise<void> {
  const path = new URL(request.url).pathname;
  const scope = path === "/api/inquiries" ? "inquiries" : path.includes("checkout") ? "checkout" : "write";
  const limit = scope === "inquiries" ? 10 : scope === "checkout" ? 20 : 120;
  const window = Math.floor(Date.now() / 60_000);
  // Cloudflare supplies this header. Do not trust arbitrary X-Forwarded-For values.
  const identity = request.headers.get("cf-connecting-ip") || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${window}:${scope}:${identity}`));
  const key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const row = await db.prepare(
    "INSERT INTO request_rate_limits (key, count, expires_at) VALUES (?, 1, ?) " +
    "ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count",
  ).bind(key, (window + 2) * 60).first() as { count: number } | null;
  // Short-lived counters only. Bounded cleanup uses the expiry index.
  await db.prepare("DELETE FROM request_rate_limits WHERE key IN (SELECT key FROM request_rate_limits WHERE expires_at < ? LIMIT 200)")
    .bind(Math.floor(Date.now() / 1000)).run();
  if (!row || row.count > limit) throw new ApiError(429, "rate_limited", "Too many requests. Please try again in a minute.");
}
