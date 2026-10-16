# Security reporting

Report suspected weaknesses privately through the [Trace security form](https://bcruse.dev/contact?type=security). Include affected URLs, safe reproduction steps, and impact. Do not put credentials or other people's data in a public issue.

This channel does not authorize testing, promise a bounty, or establish legal safe harbor. Obtain separate written authorization for testing. Stop if a test would expose unrelated information or disrupt service.

## Deployment boundary

Production requires Sites dispatch, which owns authentication and supplies the trusted `oai-authenticated-user-*` headers. Do not expose the Worker directly on another public origin: arbitrary incoming headers are not authentication. Disable direct Worker routes and enforce HTTPS at the hosting edge. Keep credentials in the provider secret store.

## Implemented controls

- Server-side roles and ownership checks; first-admin bootstrap only when no admin exists.
- Same-origin checks for mutating API requests; the signed Stripe webhook is the only exception.
- Persistent atomic per-minute write limits; 10 inquiries, 20 checkout operations, or 120 other writes per connection address per class.
- Streamed request size caps; JSON 64 KiB, uploaded design files 16 MiB. Private and revocable resources use `no-store`.
- CSP, HSTS, MIME-sniffing prevention, referrer and permissions policies. Production CSP currently permits inline hydration; nonce-based CSP is follow-up work, not a completed control.
- Stripe HMAC verification with timestamp tolerance; payments reconciled on the server; secrets encrypted at rest in application settings.
- Gerber SVG rendered as an image, not injected into the document; decompression bounds; explicit consent before external tool loading.
- Type checking, ESLint/accessibility rules, security regression tests, dependency updates, and CodeQL on repository changes.

## Operational controls

See [the launch checklist](docs/launch-checklist.md) for provider configuration, MFA, backup/restore testing, incident response, retention, and legal review. Application rate limits are not an edge WAF or volumetric DDoS defense. No code-only change verifies those operational controls.
