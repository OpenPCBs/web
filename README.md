# OpenPCB React + Clerk + Supabase

This Vite React app uses Clerk for sign-in and Supabase for project data and file storage.

## Clerk setup

Clerk React quickstart:
https://clerk.com/docs/react/getting-started/quickstart

Create a `.env.local` file and add your Clerk publishable key plus the Supabase values:

```bash
VITE_CLERK_PUBLISHABLE_KEY=YOUR_CLERK_PUBLISHABLE_KEY
VITE_SUPABASE_URL=https://dyxxuinkpqkhhboqfikn.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_EfBpVJs_--XS7e-TmKAyKA_ohVRpC13
```

The app already wraps the Vite entry point with `ClerkProvider` in `src/main.jsx` and uses `Show`, `SignInButton`, `SignUpButton`, and `UserButton` in the UI.

## Install and run

```bash
npm install
npm run dev
```

## Supabase setup

1. In Clerk, activate the Supabase integration for your Clerk instance.
2. In Supabase, add Clerk as a Third-Party Auth provider.
3. In Supabase SQL Editor, run `supabase/openpcb_schema.sql`.
4. The SQL file creates a `projects` table, enables RLS, creates a public `project-archives` bucket, and adds storage policies for paths that start with the Clerk user ID.

## Important note about the database URL

The PostgreSQL connection string is **not** used in the browser app. Keep the database password server-side only. The client app only uses the project URL and the publishable key.

## What is wired now

- Public project loading from Supabase
- Per-user dashboard filtered by Clerk user ID
- Project publishing to a `projects` table
- Optional archive upload to the `project-archives` storage bucket
- Project forking stored as a new Supabase row

## Main files

- `src/lib/supabase.js`
- `src/services/projects.js`
- `supabase/openpcb_schema.sql`


## GitHub Pages notes

This app is configured for GitHub Pages now:
- Vite uses `base: './'`
- Routing uses `HashRouter`

Set these repository secrets or environment variables before building:

```bash
VITE_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

If you deploy without the Clerk key, the app will show a config message instead of a blank page.
