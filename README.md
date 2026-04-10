# OpenPCB web

This repo now contains:

- `src/`: Vite + React frontend
- `server/`: Express API using Clerk auth and PocketBase storage

## Frontend env vars

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_BASE_URL`
- `VITE_POCKETBASE_URL`

## Backend env vars

- `PORT`
- `FRONTEND_ORIGIN`
- `POCKETBASE_URL`
- `POCKETBASE_ADMIN_EMAIL`
- `POCKETBASE_ADMIN_PASSWORD`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

## PocketBase collection

Create a `projects` collection with:

- `slug` text unique
- `title` text
- `authorName` text
- `ownerClerkId` text
- `ownerEmail` text
- `summary` text
- `description` text
- `tool` text
- `license` text
- `tags` json or text
- `category` text
- `isPublic` bool
- `forkedFrom` text optional
- `fileMeta` json or text
- `archives` file with multiple enabled
