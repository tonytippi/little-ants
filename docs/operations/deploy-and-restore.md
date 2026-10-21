# Deploy and restore (pilot)

One VPS runs everything with Docker Compose. Cloudflare Tunnel is the only way in; media comes straight from R2.

```
Browser ─► Cloudflare ─► Tunnel (cloudflared) ─► VPS: api · admin · teacher · postgres · backup
        └► media.<domain> ─► R2 bucket (approved files, cached for a year)
```

Files: [`infra/docker-compose.prod.yml`](../../infra/docker-compose.prod.yml), [`infra/Dockerfile`](../../infra/Dockerfile), [`infra/deploy.sh`](../../infra/deploy.sh), [`infra/backup-job/`](../../infra/backup-job), [`infra/env.production.example`](../../infra/env.production.example), [`infra/r2-cors.json`](../../infra/r2-cors.json).

## One-time setup

1. **VPS**: Docker with the compose plugin (2 vCPU / 4 GB RAM is enough). Clone the repository.
2. **R2**:
   - Create three buckets:
     - a private files bucket (e.g. `little-ants-files`) for every upload, drafts included. It has no public access.
     - a public media bucket (e.g. `little-ants-media`). Approved files are copied here when a reviewer approves them.
     - a backups bucket (e.g. `little-ants-backups`).
   - Connect a custom domain `media.<domain>` to the **media** bucket only. Never make the files bucket public: drafts must stay private.
   - Apply `infra/r2-cors.json` to both the files and the media bucket (change the origins to your domains). Admin uploads to the files bucket directly, and the Teacher app downloads from both.
   - Create an R2 API token with read/write on all three buckets.
3. **Google sign-in**: create an OAuth web client. Authorised redirect URI: `https://api.<domain>/api/auth/callback/google`.
4. **Tunnel**: Zero Trust → Networks → Tunnels → create a tunnel, copy its token, and add public hostnames:
   - `api.<domain>` → `http://api:3001`
   - `admin.<domain>` → `http://admin:3000`
   - `teacher.<domain>` → `http://teacher:3002`
5. **Settings**: `cp infra/env.production.example infra/.env.production` and fill in every value.
6. **First deploy**: `infra/deploy.sh`.
7. **Seed and first admin** (once):

```bash
COMPOSE="docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production"
$COMPOSE --profile tools run --rm migrate pnpm --filter @little-ants/db run seed
$COMPOSE exec api node apps/api/dist/cli/invite-staff.js --email you@example.com --roles ADMIN,AUTHOR,REVIEWER,TEACHER
```

8. **Import Level 1** from a machine that has the source files, pointing `DATABASE_URL` and the `S3_*` settings at production (or import locally and restore the dump on the VPS):

```bash
pnpm --filter @little-ants/importer run la-import --unit U01 --unit U02 --unit U03 --unit U04 --assets
```

Review the report in `plans/reports/`, fix data in Admin, then freeze the Excel and Word files (archive them; Admin is the source of truth from now on).

## Deploying a new version

```bash
git pull
infra/deploy.sh
```

The script builds images tagged with the commit, uploads a database backup to R2, runs migrations, restarts the services and waits for `/health`.

**Rollback**: `IMAGE_TAG=<previous commit> docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production up -d`. If a migration must be undone, restore the `before-deploy-<commit>` backup (below).

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

- Point an uptime checker (Cloudflare health checks or UptimeRobot) at `https://api.<domain>/health`.
- Logs: `$COMPOSE logs -f api` (Docker rotates logs with the default json-file driver; set `max-size` in `/etc/docker/daemon.json`).
- Error tracking (e.g. Sentry) is not set up yet.

## Classroom tips

- Teachers should open the Teacher app and download the week's unit the day before; lessons then run without the internet.
- On iPad, use Share → **Add to Home Screen**, otherwise Safari may clear downloaded lessons after a week without use.
