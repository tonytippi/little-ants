# Deploy and restore (pilot)

One VPS runs everything with Docker Compose. Cloudflare Tunnel is the only way in; media comes straight from R2.

```
Browser ─► Cloudflare ─► Tunnel (cloudflared) ─► 127.0.0.1:9200-9202 ─► admin · teacher · api · postgres · backup
        └► la-media.passionedu.org ─► R2 bucket (approved files, cached for a year)
```

Files: [`infra/docker-compose.prod.yml`](../../infra/docker-compose.prod.yml), [`infra/Dockerfile`](../../infra/Dockerfile), [`infra/deploy.sh`](../../infra/deploy.sh), [`infra/backup-job/`](../../infra/backup-job), [`infra/env.production.example`](../../infra/env.production.example), [`infra/r2-cors.json`](../../infra/r2-cors.json).

## One-time setup

1. **VPS**: Docker with the compose plugin (2 vCPU / 4 GB RAM is enough). Clone the repository.
2. **R2**:
   - Create three buckets:
     - a private files bucket (e.g. `little-ants-files`) for every upload, drafts included. It has no public access.
     - a public media bucket (e.g. `little-ants-media`). Approved files are copied here when a reviewer approves them.
     - a backups bucket (e.g. `little-ants-backups`).
   - Connect a custom domain `la-media.passionedu.org` to the **media** bucket only. Never make the files bucket public: drafts must stay private.
   - Apply `infra/r2-cors.json` to both the files and the media bucket (change the origins to your domains). Admin uploads to the files bucket directly, and the Teacher app downloads from both.
   - Create an R2 API token with read/write on all three buckets.
3. **Google sign-in**: create an OAuth web client. Authorised redirect URI: `https://la-api.passionedu.org/api/auth/callback/google`.
4. **Tunnel**: in Zero Trust → Networks → Tunnels, add public hostnames to the tunnel whose `cloudflared` runs on this server:
   - `la-admin.passionedu.org` → `http://localhost:9200`
   - `la-teacher.passionedu.org` → `http://localhost:9201`
   - `la-api.passionedu.org` → `http://localhost:9202` (the browser apps and Google sign-in call the API directly)

   The containers listen on `127.0.0.1` only. PostgreSQL is also published on `127.0.0.1:9203` for `psql` and the importer; do not add it to the tunnel. To run the tunnel in Docker instead, set `CLOUDFLARE_TUNNEL_TOKEN`, add `--profile tunnel` to the compose commands, and point the hostnames at `http://admin:3000`, `http://teacher:3002` and `http://api:3001`.
5. **Settings**: `cp infra/env.production.example .env.production` at the repository root and fill in every value. The compose file sets `NODE_ENV`, `DATABASE_URL` (the `postgres` container), the public URLs and `CORS_ORIGINS` itself. Changing a hostname needs a rebuild, because the URLs are baked into the browser bundles.
6. **First deploy**: `infra/deploy.sh`.
7. **Seed and first admin** (once):

```bash
COMPOSE="docker compose -f infra/docker-compose.prod.yml --env-file .env.production"
$COMPOSE --profile tools run --rm migrate pnpm --filter @little-ants/db run seed
```

The seed invites `sonnh273@gmail.com` with every staff role (pass `-e SEED_ADMIN_EMAIL=...` to the seed run for another email). Invite more staff from Admin, or with `$COMPOSE exec api node apps/api/dist/cli/invite-staff.js --email someone@example.com --roles TEACHER`.

8. **Import the curriculum** from the shared Google Drive folder. First set up [Google Drive access](#google-drive-access), then in Admin open **Drive sync** and press **Sync from Google Drive**. The `import-worker` service carries out the request; the page shows its progress and report.

9. **Test data** (testing phase only): approve and publish the imported units as they are and create the Mio Lingo campus with its Unit 5 class. The compose file sets `TEST_DATA_AFTER_SYNC: 'true'` on `import-worker`, so every sync does this; set it to `'false'` before go-live. To run it by hand (see [development](../development.md)):

```bash
$COMPOSE exec api node apps/api/dist/cli/seed-test.js
```

## Curriculum sync from Google Drive

While the curriculum is being finished, the Excel, Word and PDF files on Drive are the source of truth:

- Edit content in the Drive files. Each sync re-imports **all units with their files** and replaces unit content changed in Admin. Files uploaded in Admin stay; layouts, pictures and recordings that are no longer on Drive are removed from their materials and word cards.
- Every sync backs up the database to `infra/backup/` first and writes `manifest.json` (every Drive file with its id and version) and the report to the private bucket under `sources/<time>/`. Drive is the source of truth and keeps the file history, so the files themselves are not copied; the manifest ties the data to the exact Drive versions.
- Teachers keep the last published version until a unit is published again in Admin.
- If a request stays "Waiting", the worker is not running: `$COMPOSE logs import-worker`, then `$COMPOSE up -d import-worker`.

Files are matched by name (the report lists every file it could not place, and why):

| File on Drive | Becomes |
|---|---|
| `UnitNN_…/04_Design/DRAFT/U05_ST1_….pdf` (`U05_MD_…` = MD1, MD2…, `U05_POSTERS_…` = songs, chants, rhymes, routines) | Draft layout of the material |
| `04_Design/FINAL/**/U05-WC-02_banana.png` | Picture of word card U05-02 (the name must match the word) |
| `04_Design/FINAL/**/U05_SG1_panel3_….jpg` | Picture 3 of SG1 |
| `04_Design/FINAL/**/U05_TS1_….jpg` | Picture of TS1 |
| `04_Design/FINAL/**/U05-SG-….pdf` | Print file of SG1, SG2, … |
| `04_Design/FINAL/**/U05_UC_….jpg` | Unit cover |
| `04_Design/FINAL/**/U05_PLACE_kitchen.jpg` | Place picture "kitchen" (shown on the unit page in the Teacher app) |
| `05_Audio-Video/U05_SG1_…_v1.1.mp3` | Recording of SG1 (highest version wins) |
| `00_ROUTINES-AUDIO/LA2_RT1_…mp3` | Recording of RT1 in every unit |

Pictures must be PNG or JPEG. When a picture exists both as a regular and a 4K copy (a folder name containing "4K"), the lighter regular copy is used.

Every sync first updates the Drive mirror in `docs/Little Ants English/LA 3-6/` on the host (only changed files are downloaded) and imports from it, so the files can be read on the host. The import services run as the host user (`HOST_UID`/`HOST_GID`, default 1000) to keep the mirror, reports and backups editable there. Production media stay in R2 (`STORAGE_DRIVER=s3`); local storage is for development and testing only.

The same importer can be run by hand (reports go to `infra/import-reports/`):

```bash
$COMPOSE --profile tools run --rm import node tools/importer/dist/cli.js --drive --all --dry-run   # check only
$COMPOSE --profile tools run --rm import                                                            # write + upload files (keeps Admin edits)
```

When the content is final, stop syncing (`$COMPOSE stop import-worker`): Admin becomes the source of truth from then on.

### Google Drive access

- **Service account (recommended):** in Google Cloud, enable the Google Drive API and create a service account with no project roles. Create a JSON key and ask the folder owner to share the folder with the account's email as Viewer. Put the key in `infra/secrets/` (`chmod 600`) and set `GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE=/repo/infra/secrets/<file>.json`.
- **API key (folder shared by link only):** create an API key restricted to the Google Drive API and set `GOOGLE_DRIVE_API_KEY`. Google temporarily refuses many anonymous downloads in a short time ("automated queries"); the importer waits and retries, but a service account avoids the problem.

## Deploying a new version

```bash
git pull
infra/deploy.sh
```

The script builds images tagged with the commit, uploads a database backup to R2, runs migrations, restarts the services and waits for `/health`.

**Rollback**: `IMAGE_TAG=<previous commit> docker compose -f infra/docker-compose.prod.yml --env-file .env.production up -d`. If a migration must be undone, restore the `before-deploy-<commit>` backup (below).

## Backups

The `backup` service uploads a `pg_dump` to `<BACKUP_BUCKET>/backups/postgres/` every day at `BACKUP_HOUR_UTC` (default 19:00 UTC = 02:00 in Vietnam) and deletes backups older than `BACKUP_RETENTION_DAYS` (default 30). Media files are already in R2.

Manual backup: `$COMPOSE run --rm backup backup.sh manual`.

## Restore

```bash
$COMPOSE run --rm backup restore.sh --list
# Test a restore into a scratch database first:
$COMPOSE run --rm -e TARGET_DATABASE_URL=postgresql://little_ants:<password>@postgres:5432/restore_check backup restore.sh <file>
# Replace the live data (stop the API first):
$COMPOSE stop api && $COMPOSE run --rm backup restore.sh <file> live && $COMPOSE start api
```

Create the scratch database once with `$COMPOSE exec postgres createdb -U little_ants restore_check`. Practise a restore before the pilot starts and after any schema change.

## Monitoring

- Point an uptime checker (Cloudflare health checks or UptimeRobot) at `https://la-api.passionedu.org/health`.
- Logs: `$COMPOSE logs -f api` (Docker rotates logs with the default json-file driver; set `max-size` in `/etc/docker/daemon.json`).
- Error tracking (e.g. Sentry) is not set up yet.

## Classroom tips

- Teachers should open the Teacher app and download the week's unit the day before; lessons then run without the internet.
- On iPad, use Share → **Add to Home Screen**, otherwise Safari may clear downloaded lessons after a week without use.
