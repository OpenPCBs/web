# Trace architecture

## Boundaries

| Location | Responsibility |
| --- | --- |
| `app/**/page.tsx` | Route content and server/client composition |
| `app/components/` | Reusable customer interface components |
| `app/features/gerber/` | Browser-local fabrication ingestion, classification, rendering helpers and demo artwork |
| `app/admin/` | Operations UI, typed API adapter and administrative views |
| `app/api/` | HTTP adapters, authorization, domain workflows and persistence |
| `lib/auth/` | Better Auth configuration, email delivery, identity checks and redirect handling |
| `lib/config/` | Public brand, versioned policy text and request categories |
| `lib/client/` | Browser preference and API response utilities; no credentials |
| `lib/security/` | Request boundaries, response headers, rate limits, Stripe verification and terms acceptance |
| `lib/http/` | Framework-independent API errors |
| `db/`, `drizzle/` | Drizzle schema, Cloudflare binding types and append-only migrations |
| `worker/` | Cross-cutting API protection, image adapter, framework entrypoint |
| `tests/` | Node regression tests using actual SQLite for migrations and rate-limit SQL |

`app/api/_lib/http.ts` remains a compatibility facade for route helpers. Move domain code incrementally rather than renaming every route at once. Domain writes must authorize on the server and validate unknown inputs; never trust client prices, roles, or object ownership.

## Development rules

- TypeScript strict mode; no new `any`, duplicated policy strings, or hidden client/server coupling.
- Keep browser-only code out of server credential modules; use configuration constants for public identity.
- Use narrow types at module boundaries. Add tests for security invariants and nontrivial domain behavior, not JSX snapshots that mirror implementation.
- Use parameterized Drizzle or D1 queries. Inspect generated SQL before publication. Data migrations must preserve record ownership; migration 0005 imports existing identity IDs without changing application roles or assigning passwords.
- Never log entire request bodies, secrets, payment payloads, or database errors containing personal data.
- Run `pnpm check` and `pnpm build`. The CI workflow validates the application; production runs on Sites, not GitHub Pages.

The name Trace is independent of the existing GitHub organization/repository path, hosting project ID, data bindings and domain. Changing those infrastructure identifiers requires a separate migration.
