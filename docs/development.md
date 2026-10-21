# Development guide

The Little Ants platform is a pnpm + Turborepo workspace in TypeScript.

| Path | What it is | Port |
|---|---|---|
| `apps/api` | NestJS API (auth, content, assets, releases, teaching records) | 3001 |
| `apps/admin` | Next.js Admin for the program team | 3000 |
| `apps/teacher` | Next.js PWA teachers use in class (offline-capable) | 3002 |
| `packages/db` | Prisma schema, migrations, seed, backup, test helpers | – |
| `packages/shared` | zod DTOs, release bundle types, content rules | – |
| `packages/storage` | Object storage: R2 (S3 API) or a local folder | – |
| `packages/ui` | Shared React components, design tokens, API and auth clients | – |
| `tools/importer` | Imports the Excel Master Sheets and Word lesson plans | – |

## First-time setup

1. Install Node 24 and pnpm 12 (`corepack enable`).
2. Start PostgreSQL. Either use a local install, or `docker compose -f infra/docker-compose.yml up -d` (Postgres on port 5433, MinIO on 9000).
3. Copy `.env.example` to `.env` at the repository root and set `DATABASE_URL`.
4. Install and prepare the database:

```bash
pnpm install
pnpm db:generate
pnpm db:migrate          # applies migrations
pnpm --filter @little-ants/db build && pnpm db:seed   # program, levels, characters, default admin invite
```

5. Import the curriculum (the source files live in `docs/Little Ants English/`, which is not in git):

```bash
pnpm turbo build --filter=@little-ants/importer...
pnpm --filter @little-ants/importer run la-import --all --dry-run   # report only
pnpm --filter @little-ants/importer run la-import --all --assets    # write + upload draft files
```

Each run backs up the database first and writes a report to `plans/reports/import-*.md`. Units already edited in Admin are skipped unless you pass `--force`.

6. The seed invites `sonnh273@gmail.com` as admin (all staff roles); set `SEED_ADMIN_EMAIL` to invite someone else. To add more staff, or a development password, use `invite-staff`, then run everything:

```bash
pnpm turbo build --filter=@little-ants/api...
pnpm --filter @little-ants/api run invite-staff --email you@example.com --roles ADMIN,AUTHOR,REVIEWER,TEACHER
pnpm dev
```

## Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | api, db, importer | PostgreSQL connection string |
| `SEED_ADMIN_EMAIL` | db seed | Optional; email the seed invites as admin (default `sonnh273@gmail.com`) |
| `API_PORT`, `API_PUBLIC_URL` | api | Defaults 3001 / `http://localhost:3001` |
| `CORS_ORIGINS` | api | Comma-separated app origins |
| `BETTER_AUTH_SECRET` | api | Required in production (32+ characters) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | api | Enables "Continue with Google"; redirect URI `<API_PUBLIC_URL>/api/auth/callback/google` |
| `AUTH_COOKIE_DOMAIN` | api | e.g. `.littleants.vn` so admin/teacher/api share the session |
| `AUTH_DEV_PASSWORD_LOGIN` | api | `true` enables email + password sign-in for invited staff. Refused in production |
| `STORAGE_DRIVER` | api, importer | `local` (default, files in `infra/storage/`) or `s3` |
| `S3_*`, `MEDIA_PUBLIC_BASE_URL` | api, importer | R2 settings when `STORAGE_DRIVER=s3`: `S3_BUCKET` is private (all uploads), `S3_PUBLIC_BUCKET` holds approved copies behind the media domain. Production must use `s3` |
| `NEXT_PUBLIC_API_URL` | admin, teacher | API URL baked into the browser bundle |
| `NEXT_PUBLIC_TEACHER_APP_URL` | admin | Used for "Preview in Teacher app" links |

To try sign-in without Google, set `AUTH_DEV_PASSWORD_LOGIN=true` and create a password account:
`pnpm --filter @little-ants/api run invite-staff --email you@example.com --roles ADMIN --password '<at least 8 characters>'`.

## Content workflow

- Authors edit drafts in Admin. Every change writes a revision (history, diff, restore).
- Editing approved content starts a new draft version; it must be reviewed again. Approved files are never overwritten: a replacement upload becomes a new version.
- Reviewers approve items (or the whole unit) and publish a **release**: an immutable bundle the Teacher app downloads for offline teaching. Publishing is blocked until every item is approved and the content rules report no errors.

## Tests

```bash
pnpm turbo lint typecheck test build
```

Database tests use their own schemas (`test_db`, `test_api`, `test_importer`) in the same database and never touch `public`. The importer tests read the real Unit 1 files and are skipped when `docs/` is not present (for example in CI).

## Backups

`pnpm --filter @little-ants/db backup <label>` writes `infra/backup/<time>-<label>.dump` (pg_dump custom format). The importer runs it automatically; run it yourself before any manual migration or bulk data change.
