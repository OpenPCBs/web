# Trace accounts and Google sign-in

This change replaces application ChatGPT login with Trace accounts using Better Auth 1.7.10, Drizzle, and the existing D1 database. Public browsing remains available. All account and administrative APIs use verified Trace sessions; platform identity headers are ignored.

## Activation requirements

Configure the following in the existing Site's runtime environment settings. Keep secrets out of GitHub, chat, screenshots, and public variables. Changing runtime settings requires a subsequent deployment to take effect.

| Key | Value | Secret |
| --- | --- | --- |
| `AUTH_ORIGIN` | `https://bcruse.dev` | No |
| `AUTH_SECRET` | Unique cryptographically random value of at least 32 bytes | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth web application's client ID | No |
| `GOOGLE_CLIENT_SECRET` | Matching Google OAuth client secret | Yes |
| `RESEND_API_KEY` | Resend key permitted to send transactional email | Yes |
| `AUTH_EMAIL_FROM` | `Trace <accounts@your-verified-domain>` using an actual verified sender | No |

Keep `AUTH_SECRET` stable. Rotating it invalidates signed sessions and affects encrypted OAuth tokens. Do not reuse the Stripe settings encryption key.

### Google

1. In Google Cloud / Google Auth Platform, use a project owned by the business. Configure the audience and consent screen with Trace's actual operator details, the home page, privacy notice, and terms URLs.
2. Create an OAuth client of type **Web application**.
3. Add `https://bcruse.dev/api/auth/callback/google` as an authorized redirect URI, exactly. Use only the default identity scopes (`openid`, `email`, and `profile`).
4. Configure the client ID and secret above. When Google is in testing mode, only designated test users can sign in; publish the OAuth application as appropriate for the intended audience.

Authentication pages redirect alternate site hostnames to `AUTH_ORIGIN`, keeping session cookies and the OAuth callback on one origin. Do not add wildcard callback domains.

### Email

Verify a sender domain in Resend and apply the DNS records it supplies. Set a working `AUTH_EMAIL_FROM` and the API key. The application sends only the requested account-verification and password-reset messages, as plain text. It does not use the user's connected Gmail account or send marketing email.

Email ownership is required before password sign-in. Signup and password-reset responses avoid confirming whether an address is registered. Verification/reset links expire after one hour. No credentials means the corresponding sign-in option fails closed; the UI does not advertise a working provider that is unavailable.

## Existing account migration

Migration `0005_trace_accounts.sql` creates separate authentication tables and imports existing application user IDs and email addresses. Existing roles, orders, carts, designs, files, and audit history retain their original foreign keys. It assigns **no passwords** and imports **no sessions**.

Existing users can choose Google with the same verified email or use **Forgot password or signing in for the first time?** to set their first Trace password through an emailed link. An attacker cannot claim an existing account just by registering its email address. Google linking requires a verified provider email and a locally verified account; unverified native accounts are not implicitly linked. A suspended account cannot sign in, and its existing sessions are denied by application identity checks.

## Release sequence

1. Configure the Google and email settings and confirm the owner controls the migrated account's inbox or matching Google identity.
2. Take the normal D1 backup before applying migrations. The migration is additive and preserves existing records, but authentication changes still need a recovery plan.
3. Run `pnpm check` and the production build. Publish the saved source and archive to the existing Sites project. Never change audience or data bindings for this cutover.
4. Verify a new account's emailed link, password sign-in, Google callback, password reset, logout, and owner/admin access on the actual custom domain. Check an existing order and a private file remain bound to the same user.
5. If live provider configuration prevents sign-in, restore the previous application version while correcting configuration. Preserve the additive auth tables; do not drop users or application data.

The replacement must not be activated while both sign-in methods are unavailable. The prior production version stays live until the configuration above is present. Browser testing, actual email delivery, and a real Google callback were unavailable during implementation; automated tests use a local email sink and no live customer accounts.

## Security and tests

- Better Auth provides scrypt password hashing, signed database-backed sessions, OAuth state handling, verification and single-use reset tokens. Authentication cookies use Secure, HttpOnly, and SameSite=Lax attributes. Sessions expire after seven days; login currently requests a browser-session cookie.
- Exact trusted origin, existing CSRF checks, request body limits, and persistent atomic rate counters apply. Authentication limits are shared across Worker instances; password sign-in permits five attempts per minute per connection address, signup three per minute, recovery three per five minutes.
- Role changes and suspension revoke sessions. Password reset revokes previous sessions. Authorization still checks application ownership and current role/status on the server.
- The dedicated tests exercise registration, verification, password hashing, valid/invalid login, logout, reset replay and session revocation, legacy ID/order/role preservation, suspension, cross-origin requests, callback redirects, forged cookies, OAuth state rejection, persistent rate limiting, and missing configuration.
- Public account deletion and provider-linking/token-management endpoints are disabled until a separate reviewed account-management flow is supplied.

References: [Better Auth email/password](https://better-auth.com/docs/authentication/email-password), [Google provider](https://better-auth.com/docs/authentication/google), [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [account linking](https://better-auth.com/docs/concepts/users-accounts), and [Resend sending API](https://resend.com/docs/api-reference/emails/send-email).
