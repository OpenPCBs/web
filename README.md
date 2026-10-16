# Trace

Trace is a commerce-first storefront for specialized electronics and test equipment. Trace Works is its engineering division for versioned PCB designs, browser-local Gerber inspection, and paid, revision-bound lab verification.

## What is included

- Distributor-style product catalog, search, filters, stock and fulfillment details
- Design marketplace with revision history, BOM data, license tiers and lab evidence
- Local Gerber/Excellon workbench with ZIP import, layer controls and Ucamco reference-viewer access
- Paid verification workflow with server-controlled Stripe pricing and signed webhook handling
- Cloudflare D1 data model and low-cost R2 object storage with authorization-checked file access
- Account, cart, order, publishing, documentation and API routes

## Local development

Requirements: Node.js 22.15 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

The site is then available at `http://localhost:3000`.

Run production validation with:

```bash
pnpm check
pnpm build
```

## Configuration

Copy `.env.example` to your local environment and set the values that apply. Stripe is optional for browsing the site, but required to collect lab-verification payments. `APP_ORIGIN` must be the exact HTTPS production origin.

Cloudflare bindings are declared in `.openai/hosting.json`:

- `DB`: D1 database for users, designs, products, orders and verification records
- `FILES`: R2 bucket for private design packages and report artifacts

Published catalog and marketplace records come from D1. The Gerber workbench includes a clearly labeled local demonstration board.

## Launch notes

- Confirm supplier or affiliate agreements, live price/stock feeds, image usage rights and fulfillment SLAs before accepting product orders.
- Complete a formal trademark and domain clearance for **Trace** before public launch.
- Keep Stripe keys and webhook secrets in the hosting secret store; never expose them as public variables.
- Lab badges are tied to an exact revision and should not be described as regulatory certification unless the testing scope and accreditation support that claim.

The repository remains at `OpenPCBs/web`; the customer-facing brand is Trace.

## Engineering and operational documentation

- [Architecture and contribution rules](docs/architecture.md)
- [Security model and reporting](SECURITY.md)
- [Launch/compliance checklist and remaining owner decisions](docs/launch-checklist.md)

GitHub Actions validates type safety, lint, regression tests, and the production build. This server app cannot run on static GitHub Pages: production uses the existing Sites project with D1/R2. Preserve its ID and data bindings. Generated migrations are applied by Sites before the Worker is published.

Privacy choices are stored locally for 180 days. No advertising or analytics integration is configured. New checkout requests require the current policy version; custom Stripe checkout domains are not currently supported by the client redirect allowlist. The policy pages are practical notices, not a claim of complete legal compliance.
