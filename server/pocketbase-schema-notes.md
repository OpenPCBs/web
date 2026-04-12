# PocketBase schema notes

Create a `projects` collection with these fields:

- `slug` — text, unique
- `title` — text
- `authorName` — text
- `ownerClerkId` — text, indexed
- `ownerEmail` — email or text
- `summary` — text
- `description` — editor or text
- `tool` — text or select
- `license` — text
- `tags` — json or plain text
- `category` — text
- `isPublic` — bool
- `forkedFrom` — text or relation, optional
- `fileMeta` — json or text
- `archives` — file, multiple enabled
