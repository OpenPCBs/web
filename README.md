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

## Troubleshooting

### Guest mode: `Could not find the table 'public.projects' in the schema cache`

This means the connected Supabase project does not currently expose the `public.projects` table through the Data API.

Fix it by:

1. Opening the Supabase SQL editor for the same project used by `VITE_SUPABASE_URL`.
2. Running `supabase/openpcb_schema.sql`.
3. Running:

```sql
NOTIFY pgrst, 'reload schema';
```

4. Refreshing the app.

### Logged in: `No suitable key or wrong key type`

This usually means Supabase rejected the Clerk session token for this project.

Check the following:

1. The Clerk instance in your frontend matches the Clerk instance connected to Supabase.
2. Supabase has Clerk enabled as a Third-Party Auth provider.
3. `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` point to that same Supabase project.
4. You are not mixing keys or project URLs from another environment.

### Important behavior

Public browsing should still work with the Supabase publishable key alone. Publishing and forking require the Clerk to Supabase auth connection to be configured correctly.

## GitHub Pages notes

This app uses:

- `HashRouter`
- `base: './'`

That keeps routes working on GitHub Pages.
