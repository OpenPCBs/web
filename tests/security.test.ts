import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { assertSameOrigin, boundRequestBody, readBoundedJson, MAX_JSON_BYTES } from "../lib/security/request";
import { ApiError } from "../lib/http/api-error";
import { securityHeaders } from "../lib/security/headers";
import { enforceRateLimit } from "../lib/security/rate-limit";
import { verifyStripeSignature } from "../lib/security/stripe-signature";
import { requireTermsAcceptance, addTermsMetadata } from "../lib/security/terms";
import { parsePrivacyChoice } from "../lib/client/privacy";
import { site } from "../lib/config/site";

const origin = "https://bcruse.dev";
const mutation = (headers: Record<string, string> = {}, path = "/api/cart") => new Request(origin + path, { method: "POST", headers });
const hasStatus = (status: number) => (error: unknown) => error instanceof ApiError && error.status === status;

test("mutations require the exact origin and reject cross-site and sibling origins", () => {
  assert.doesNotThrow(() => assertSameOrigin(mutation({ origin, "sec-fetch-site": "same-origin" })));
  for (const headers of ([{}, { origin: "null" }, { origin: "https://evil.example" }, { origin: "https://shop.bcruse.dev" }, { origin, "sec-fetch-site": "cross-site" }] as Record<string, string>[])) {
    assert.throws(() => assertSameOrigin(mutation(headers)), hasStatus(403));
  }
  assert.doesNotThrow(() => assertSameOrigin(new Request(origin + "/api/cart")));
  assert.doesNotThrow(() => assertSameOrigin(mutation({}, "/api/stripe/webhook")));
  assert.throws(() => assertSameOrigin(mutation({}, "/api/stripe/webhook/extra")), hasStatus(403));
});

test("JSON requests reject wrong types, malformed bodies, arrays, and unknown-length oversized streams", async () => {
  const json = (body: string, type = "application/json") => new Request(origin + "/api/cart", { method: "POST", headers: { "content-type": type }, body });
  assert.deepEqual(await readBoundedJson(json('{"quantity":2}')), { quantity: 2 });
  await assert.rejects(readBoundedJson(json("{}", "text/plain")), hasStatus(415));
  for (const body of ["null", "[]", "123", "{broken"]) await assert.rejects(readBoundedJson(json(body)), hasStatus(400));
  await assert.rejects(readBoundedJson(json(JSON.stringify({ value: "x".repeat(MAX_JSON_BYTES) }))), hasStatus(413));
  assert.throws(() => boundRequestBody(mutation({ "content-length": String(MAX_JSON_BYTES + 1) })), hasStatus(413));
});

test("API and account responses cannot be cached, including errors and downloads", () => {
  for (const path of ["/api/files/a", "/api/cart", "/admin", "/account", "/cart"]) {
    const response = securityHeaders(new Request(origin + path), new Response("private", { headers: { "Cache-Control": "public, max-age=3600", "X-Powered-By": "server" } }));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-powered-by"), null);
    assert.match(response.headers.get("content-security-policy")!, /object-src 'none'/);
    assert.doesNotMatch(response.headers.get("content-security-policy")!, /unsafe-eval/);
    assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000");
  }
});

test("all migrations apply and preserve existing store settings", () => {
  const db = new DatabaseSync(":memory:");
  const migrations = readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort();
  for (const name of migrations.slice(0, -1)) db.exec(readFileSync(`drizzle/${name}`, "utf8"));
  db.prepare("INSERT INTO store_settings (id, store_name, support_email, flat_shipping_cents) VALUES (?, ?, ?, ?)").run("store", "Thevenin Supply", "support@example.com", 1599);
  db.exec(readFileSync(`drizzle/${migrations.at(-1)}`, "utf8"));
  const row = db.prepare("SELECT * FROM store_settings WHERE id = 'store'").get()!;
  assert.equal(row.support_email, "support@example.com");
  assert.equal(row.flat_shipping_cents, 1599);
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  db.close();
});

test("rate limits use persisted atomic counters and separate traffic classes", async () => {
  const sql = new DatabaseSync(":memory:");
  sql.exec("CREATE TABLE request_rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL)");
  function statement(query: string, values: unknown[] = []): D1PreparedStatement {
    const prepared = sql.prepare(query);
    return {
      bind: (...next) => statement(query, next),
      first: async () => prepared.get(...values as string[]) ?? null,
      run: async () => prepared.run(...values as string[]),
      all: async () => prepared.all(...values as string[]),
      raw: async () => [],
    };
  }
  const db = { prepare: (query: string) => statement(query) } as D1Database;
  const request = mutation({ "cf-connecting-ip": "192.0.2.1" }, "/api/inquiries");
  for (let i = 0; i < 10; i++) await enforceRateLimit(request, db);
  await assert.rejects(enforceRateLimit(request, db), hasStatus(429));
  await enforceRateLimit(mutation({ "cf-connecting-ip": "192.0.2.1" }, "/api/cart"), db);
  await enforceRateLimit(mutation({ "cf-connecting-ip": "192.0.2.2" }, "/api/inquiries"), db);
  assert.doesNotMatch(JSON.stringify(sql.prepare("SELECT * FROM request_rate_limits").all()), /192\.0\.2/);
  sql.close();
});

test("Stripe webhook verification rejects tampering and replay outside the tolerance", async () => {
  const body = '{"id":"evt_test"}';
  const secret = "test-only-secret";
  async function signature(timestamp: number) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
    return `t=${timestamp},v1=${Buffer.from(digest).toString("hex")}`;
  }
  const valid = await signature(Math.floor(Date.now() / 1000));
  assert.equal(await verifyStripeSignature(body, valid, secret), true);
  assert.equal(await verifyStripeSignature(body + " ", valid, secret), false);
  assert.equal(await verifyStripeSignature(body, await signature(Math.floor(Date.now() / 1000) - 600), secret), false);
  assert.equal(await verifyStripeSignature(body, "t=bad,v1=bad", secret), false);
});

test("checkout requires the current policy and records it in provider metadata", () => {
  assert.throws(() => requireTermsAcceptance({}), hasStatus(400));
  assert.throws(() => requireTermsAcceptance({ acceptedTermsVersion: "old" }), hasStatus(400));
  requireTermsAcceptance({ acceptedTermsVersion: site.policyVersion });
  const form = new URLSearchParams();
  addTermsMetadata(form);
  assert.equal(form.get("metadata[terms_version]"), site.policyVersion);
  assert.ok(form.get("metadata[terms_accepted_at]"));
});

test("privacy preferences fail closed when malformed, expired, or from a future version", () => {
  const now = 2_000_000_000_000;
  for (const raw of [null, "broken", "{}", JSON.stringify({ version: 1, externalMedia: true, updatedAt: 1 }), JSON.stringify({ version: 2, externalMedia: true, updatedAt: now }), JSON.stringify({ version: 1, externalMedia: true, updatedAt: now + 1 })]) assert.equal(parsePrivacyChoice(raw, now), null);
  assert.deepEqual(parsePrivacyChoice(JSON.stringify({ version: 1, externalMedia: false, updatedAt: now }), now), { version: 1, externalMedia: false, updatedAt: now });
});
