# OpenPCB React + Clerk + Supabase

OpenPCB is a Vite + React app for publishing PCB projects, previewing uploads before publishing, and exploring public hardware boards in a reusable catalog.

## What is implemented

- Clerk authentication for sign-in and user identity
- Supabase-backed public projects, user dashboard, and archive uploads
- Production cleanup of demo content and prototype copy
- Upload previews for images, PDFs, Gerber/drill text files, and KiCad text files
- Project pages designed for documentation-first manufacturing handoff

## Environment variables

Create a `.env.local` file:

```bash
VITE_CLERK_PUBLISHABLE_KEY=YOUR_CLERK_PUBLISHABLE_KEY
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
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

## GitHub Pages notes

This app uses:

- `HashRouter`
- `base: './'`

That keeps routes working on GitHub Pages.
