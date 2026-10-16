import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { createTraceAuth } from "../lib/auth/factory";
import { authCapabilities } from "../lib/auth/config";
import { safeReturnPath } from "../lib/auth/paths";
import { site } from "../lib/config/site";
import type { AuthMessage } from "../lib/auth/email";
import { authDatabase } from "./helpers/auth-database";
import { traceIdentity } from "../lib/auth/identity";

const origin = "https://bcruse.dev";
const password = "test-only-long-password-762390";
const env = { AUTH_SECRET: randomBytes(48).toString("hex"), AUTH_ORIGIN: origin, RESEND_API_KEY: "test-mail-sink", AUTH_EMAIL_FROM: "Trace <noreply@example.com>", GOOGLE_CLIENT_ID: "test-google-client", GOOGLE_CLIENT_SECRET: "test-google-secret" };
function fixture(legacy = false) {
  const { db, sqlite } = authDatabase(legacy ? (db) => {
    db.prepare("INSERT INTO users (id,email,display_name,role) VALUES (?,?,?,?)").run("legacy-owner", "owner@example.com", "Owner", "admin");
    db.prepare("INSERT INTO orders (id,user_id,subtotal_cents,total_cents) VALUES (?,?,?,?)").run("existing-order", "legacy-owner", 3000, 3000);
  } : undefined);
  const mail: AuthMessage[] = [];
  const auth = createTraceAuth(db, env, async (message) => { mail.push(message); });
  const call = (path: string, body?: Record<string, unknown>, cookie = "", ip = "192.0.2.7") => auth.handler(new Request(`${origin}/api/auth/${path}`, {
    method: body ? "POST" : "GET",
    headers: { origin, "content-type": "application/json", cookie, "cf-connecting-ip": ip },
    body: body ? JSON.stringify(body) : undefined,
  }));
  const signup = () => call("sign-up/email", { name: "Test User", email: "new@example.com", password, acceptTerms: true, termsVersion: site.policyVersion, callbackURL: "/login" });
  return { db, sqlite, mail, auth, call, signup };
}

function sessionCookie(response: Response) {
  const cookies = response.headers.getSetCookie();
  const session = cookies.find((cookie) => cookie.startsWith("__Secure-trace.session_token="));
  assert.ok(session, "Secure session cookie must be issued");
  assert.match(session, /HttpOnly/i);
  assert.match(session, /SameSite=Lax/i);
  assert.match(session, /Secure/i);
  return session.split(";")[0];
}

test("native registration verifies email, hashes passwords, authenticates, and revokes logout sessions", async () => {
  const f = fixture();
  try {
    const invalid = await f.call("sign-up/email", { name: "Test", email: "new@example.com", password });
    assert.equal(invalid.status, 400);
    assert.equal((await f.signup()).status, 200);
    assert.equal(f.mail[0].kind, "verify");
    const stored = f.sqlite.prepare("SELECT password FROM auth_account").get()!;
    assert.notEqual(stored.password, password);
    assert.equal((await f.call("sign-in/email", { email: "new@example.com", password })).status, 403);
    const verified = await f.auth.handler(new Request(f.mail[0].url));
    assert.ok(verified.status === 200 || verified.status === 302);
    assert.equal((await f.call("sign-in/email", { email: "new@example.com", password: "incorrect-password" })).status, 401);
    const signedIn = await f.call("sign-in/email", { email: "new@example.com", password });
    assert.equal(signedIn.status, 200);
    const cookie = sessionCookie(signedIn);
    const session = await (await f.call("get-session", undefined, cookie)).json() as { user: { email: string } };
    assert.equal(session.user.email, "new@example.com");
    assert.equal((await f.call("sign-out", {}, cookie)).status, 200);
    assert.equal(await (await f.call("get-session", undefined, cookie)).json(), null);
  } finally { f.sqlite.close(); }
});

test("legacy ownership survives migration and first password setup requires a single-use emailed token", async () => {
  const f = fixture(true);
  try {
    assert.equal(f.sqlite.prepare("SELECT id FROM auth_user WHERE email='owner@example.com'").get()!.id, "legacy-owner");
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM auth_account").get()!.n, 0);
    await f.call("sign-up/email", { name: "Attacker", email: "owner@example.com", password, acceptTerms: true, termsVersion: site.policyVersion });
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM auth_account").get()!.n, 0);
    assert.equal((await f.call("request-password-reset", { email: "owner@example.com", redirectTo: "/reset-password" })).status, 200);
    const reset = f.mail.find((message) => message.kind === "reset")!;
    assert.ok(reset);
    const token = new URL(reset.url).pathname.split("/").at(-1)!;
    assert.equal((await f.call("reset-password", { token, newPassword: password })).status, 200);
    assert.equal((await f.call("reset-password", { token, newPassword: password + "changed" })).status, 400);
    const response = await f.call("sign-in/email", { email: "owner@example.com", password });
    assert.equal(response.status, 200);
    const cookie = sessionCookie(response);
    const session = await (await f.call("get-session", undefined, cookie)).json() as { user: { id: string; name: string; email: string; emailVerified: boolean } };
    assert.equal(session.user.id, "legacy-owner");
    assert.equal(f.sqlite.prepare("SELECT user_id FROM orders WHERE id='existing-order'").get()!.user_id, "legacy-owner");
    assert.equal(f.sqlite.prepare("SELECT role FROM users WHERE id='legacy-owner'").get()!.role, "admin");
    assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal((await traceIdentity(f.db, session))?.userId, "legacy-owner");
    f.sqlite.prepare("UPDATE users SET status='suspended' WHERE id='legacy-owner'").run();
    assert.equal(await traceIdentity(f.db, session), null);
    assert.equal((await f.call("sign-in/email", { email: "owner@example.com", password })).status, 403);
  } finally { f.sqlite.close(); }
});

test("password reset revokes existing sessions and unverified identities have no application access", async () => {
  const f = fixture();
  try {
    await f.signup();
    const authUser = f.sqlite.prepare("SELECT id FROM auth_user").get()!;
    assert.equal(await traceIdentity(f.db, { user: { id: String(authUser.id), name: "Test", email: "new@example.com", emailVerified: false } }), null);
    await f.auth.handler(new Request(f.mail[0].url));
    const response = await f.call("sign-in/email", { email: "new@example.com", password });
    const cookie = sessionCookie(response);
    await f.call("request-password-reset", { email: "new@example.com", redirectTo: "/reset-password" });
    const token = new URL(f.mail.find((message) => message.kind === "reset")!.url).pathname.split("/").at(-1)!;
    assert.equal((await f.call("reset-password", { token, newPassword: password + "-updated" })).status, 200);
    assert.equal(await (await f.call("get-session", undefined, cookie)).json(), null);
    assert.equal((await f.call("sign-in/email", { email: "new@example.com", password })).status, 401);
    assert.equal((await f.call("sign-in/email", { email: "new@example.com", password: password + "-updated" })).status, 200);
  } finally { f.sqlite.close(); }
});

test("auth rejects cross-origin requests, unsafe callback redirects, forged sessions, and OAuth state", async () => {
  const f = fixture();
  try {
    const response = await f.auth.handler(new Request(`${origin}/api/auth/sign-in/email`, { method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({ email: "a@example.com", password }) }));
    assert.equal(response.status, 403);
    assert.equal(await (await f.call("get-session", undefined, "__Secure-trace.session_token=forged")).json(), null);
    assert.equal((await f.call("sign-in/social", { provider: "google", callbackURL: "https://attacker.example" })).status, 403);
    const google = await f.call("sign-in/social", { provider: "google", callbackURL: "/account" });
    assert.equal(google.status, 200);
    const data = await google.json() as { url: string };
    const url = new URL(data.url);
    assert.equal(url.origin, "https://accounts.google.com");
    assert.equal(url.searchParams.get("redirect_uri"), `${origin}/api/auth/callback/google`);
    assert.ok(url.searchParams.get("state"));
    const forged = await f.call("callback/google?code=fake&state=wrong");
    assert.equal(forged.status, 302);
    assert.match(forged.headers.get("location")!, /error=/);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM auth_session").get()!.n, 0);
  } finally { f.sqlite.close(); }
});

test("auth rate limits are shared between instances and persist in the database", async () => {
  const f = fixture();
  try {
    for (let i = 0; i < 5; i++) assert.equal((await f.call("sign-in/email", { email: "unknown@example.com", password })).status, 401);
    const other = createTraceAuth(f.db, env, async () => {});
    const response = await other.handler(new Request(`${origin}/api/auth/sign-in/email`, { method: "POST", headers: { origin, "content-type": "application/json", "cf-connecting-ip": "192.0.2.7" }, body: JSON.stringify({ email: "unknown@example.com", password }) }));
    assert.equal(response.status, 429);
    assert.doesNotMatch(JSON.stringify(f.sqlite.prepare("SELECT * FROM request_rate_limits").all()), /192\.0\.2|unknown@example/);
  } finally { f.sqlite.close(); }
});

test("authentication fails closed without providers and return paths stay on site", () => {
  assert.deepEqual(authCapabilities({}), { configured: false, email: false, google: false });
  assert.equal(authCapabilities({ ...env, AUTH_ORIGIN: "http://bcruse.dev" }).configured, false);
  assert.equal(authCapabilities({ ...env, GOOGLE_CLIENT_SECRET: undefined }).google, false);
  for (const input of ["//evil.example", "/\\evil.example", "https://evil.example", "/login", "/api/auth/callback/google", "javascript:alert(1)"]) assert.equal(safeReturnPath(input), "/account");
  assert.equal(safeReturnPath("/cart?checkout=1#items"), "/cart?checkout=1#items");
});
