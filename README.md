# OpenPCB React + Clerk + Supabase

OpenPCB is a Vite + React app for publishing PCB projects, previewing uploads before publish, exploring public boards, and requesting fabrication quotes that can be checked out through Stripe.

## What is implemented

- Clerk authentication for sign-in and user identity
- Supabase-backed public projects, user dashboard, and archive uploads
- Production cleanup of demo content and prototype copy
- Upload previews for images, PDFs, Gerber/drill text files, and KiCad text files
- Project-page quote actions for JLCPCB and PCBWay
- Stripe checkout hook for paid fabrication orders

## Environment variables

Create a `.env.local` file:

```bash
VITE_CLERK_PUBLISHABLE_KEY=YOUR_CLERK_PUBLISHABLE_KEY
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_FUNCTIONS_URL=https://your-project.supabase.co/functions/v1
VITE_APP_URL=https://your-public-site.example
```

## Frontend setup

```bash
npm install
npm run dev
```

## Supabase setup

1. In Clerk, activate the Supabase integration for your Clerk instance.
2. In Supabase, add Clerk as a Third-Party Auth provider.
3. Run `supabase/openpcb_schema.sql` in the Supabase SQL editor.
4. Create or confirm the `project-archives` bucket.
5. Deploy the Edge Functions in `supabase/functions`.

## Edge Function secrets

Set these on Supabase before deploying functions:

```bash
STRIPE_SECRET_KEY=...
JLCPCB_API_TOKEN=...
PCBWAY_API_KEY=...
```

Optional overrides:

```bash
JLCPCB_API_BASE_URL=https://api.jlcpcb.com
PCBWAY_API_BASE_URL=https://api-partner.pcbway.com/api
STRIPE_PRICE_CURRENCY=usd
```

## Important note on provider APIs

The included JLCPCB and PCBWay functions are integration templates. Keep the secrets server-side only. Depending on the exact API scope approved for your vendor accounts, you may need to adjust request field names or auth headers to match your account.

## GitHub Pages notes

This app uses:

- `HashRouter`
- `base: './'`

That keeps routes working on GitHub Pages.
