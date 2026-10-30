# Deploy and restore (pilot)

One VPS runs everything with Docker Compose. Cloudflare Tunnel is the only way in; media comes straight from R2.

```
Browser ─► Cloudflare ─► Tunnel (cloudflared) ─► 127.0.0.1:9200-9202, 9204 ─► admin · teacher · api · student · postgres · backup
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
   - Apply `infra/r2-cors.json` to both the files and the media bucket (change the origins to your domains). Admin uploads to the files bucket directly, the Teacher app downloads from both, and the Student app downloads a unit's media for offline listening.
   - Create an R2 API token with read/write on all three buckets.
3. **Google sign-in**: create an OAuth web client. Authorised redirect URIs: `https://la-api.passionedu.org/api/auth/callback/google` (staff) and `https://la-api.passionedu.org/api/parent/auth/google/callback` (parents in the student app).
4. **Tunnel**: in Zero Trust → Networks → Tunnels, add public hostnames to the tunnel whose `cloudflared` runs on this server:
   - `la-admin.passionedu.org` → `http://localhost:9200`
   - `la-teacher.passionedu.org` → `http://localhost:9201`
   - `la-api.passionedu.org` → `http://localhost:9202` (the browser apps and Google sign-in call the API directly)
   - `la-student.passionedu.org` → `http://localhost:9204` (Listening Time for children and parents)

   The containers listen on `127.0.0.1` only. PostgreSQL is also published on `127.0.0.1:9203` for `psql` and the importer; do not add it to the tunnel. To run the tunnel in Docker instead, set `CLOUDFLARE_TUNNEL_TOKEN`, add `--profile tunnel` to the compose commands, and point the hostnames at `http://admin:3000`, `http://teacher:3002`, `http://student:3003` and `http://api:3001`.
5. **Settings**: `cp infra/env.production.example .env.production` at the repository root and fill in every value. The compose file sets `NODE_ENV`, `DATABASE_URL` (the `postgres` container), the public URLs and `CORS_ORIGINS` itself. Changing a hostname needs a rebuild, because the URLs are baked into the browser bundles.
6. **First deploy**: `infra/deploy.sh`.
7. **Seed and first admin** (once):

```bash
COMPOSE="docker compose -f infra/docker-compose.prod.yml --env-file .env.production"
$COMPOSE --profile tools run --rm migrate pnpm --filter @little-ants/db run seed
```

The seed invites `sonnh273@gmail.com` with every HQ role (pass `-e SEED_ADMIN_EMAIL=...` to the seed run for another email). Create schools in Admin → **Schools**; school admins then add their teachers in **School staff**. From the command line: `$COMPOSE exec api node apps/api/dist/cli/invite-staff.js --email someone@example.com --school "School name" --school-role TEACHER` (or `--roles AUTHOR` for HQ staff).

8. **Import the curriculum** from the shared Google Drive folder. First set up [Google Drive access](#google-drive-access), then in Admin open **Drive sync** and press **Sync from Google Drive**. The `import-worker` service carries out the request; the page shows its progress and report.

9. **Test data** (testing phase only): approve and publish the imported units as they are and create the Little Ants Test School with its Mio Lingo campus and Unit 5 class. Set `SEED_TEST_PARENT_EMAILS` in `.env.production` to Google accounts that may sign in to the student app as test parents. The compose file sets `TEST_DATA_AFTER_SYNC: 'true'` on `import-worker`, so every sync does this; set it to `'false'` before go-live. To run it by hand (see [development](../development.md)):

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

## Listening Time (student app)

- Parents open `https://la-student.passionedu.org` (the Teacher app's **Home listening** page shows the link and a QR code) and sign in with the Google account whose email the school entered for their child (Admin → class → child → **Parents**). Two devices per parent; a third asks which one to sign out.
- When a child leaves (or their class is stopped), the parents lose access at once; moving to another class or school keeps the child's progress and studied units.
- Teachers signed in to the Teacher app can switch the student app to **At school** to play the lesson's leaf on the classroom screen.

## Showing lessons on a TV (Google Cast)

- Teachers tap **Show on TV → Chromecast / Android TV** in a lesson (Chrome only, same Wi-Fi as the TV). The TV shows the stage and plays the audio; the teacher's screen keeps the notes. The in-app guide is `https://la-teacher.passionedu.org/tv-help`.
- The TV runs the Cast receiver app **`B1587FA6`**, registered in the [Google Cast SDK Developer Console](https://cast.google.com/publish) and pointing at `https://la-teacher.passionedu.org/cast-receiver`. The ID lives in `apps/teacher/src/lib/cast-protocol.ts`. Changing the receiver URL in the console changes it for every TV.
- Until the receiver is **published** in the console, only TVs whose serial number is registered there (**Add New Device**, then unplug and restart the TV once it shows "Ready For Testing", about 15 minutes) can run it. Use the **Google Cast serial** from the TV's Settings → Google Cast → About → Serial number (a long code such as `HB0pZFuEEGpYghvlnK3a`), not the TV's own serial number: with the wrong one, Chrome's built-in Cast still finds the TV but the app does not.
- Publishing is slow to reach TVs: in October 2026 the first TV accepted the published app about 16 hours after publishing, although Google's config URL (`https://clients3.google.com/cast/chromecast/device/app?a=B1587FA6`) served it much earlier. Check what a TV accepts with a Cast `GET_APP_AVAILABILITY` request to port 8009 before looking for a bug.
- Classroom TVs run an old browser (Casper Android TV: Chrome 92, Cast 1.56), which cannot run the Next.js app. The receiver is therefore a static page (`apps/teacher/public/cast-receiver/`) with code compiled for ES2020 from `apps/teacher/cast-receiver/receiver.ts`; `/cast-receiver` is rewritten to it. Draft PDFs on the TV use pdf.js 3's legacy build (package alias `pdfjs-tv`, with eval disabled), because pdf.js 6 needs newer browsers even in its legacy build. Errors show on the TV in a red box with the browser version.
- The receiver's modules (`receiver.ts` and the Teacher app files it imports) are loaded by the TV as plain ES modules, so their runtime imports must end in `.js`; a test in `apps/teacher/test/cast.test.ts` checks this, because a missing extension stops the receiver from starting.
- **Hide on TV** sends the TV a frame with only `splash: true` (the Little Ants logo) and no ink, so nothing hidden reaches the TV. **Wide** mode's drawing goes over the same three paths (Cast, laptop screen relay, second window) as `ink` / `ink-live` messages, anchored to the picture or page shown (`apps/teacher/src/lib/ink.ts`).
- The receiver has no login and no data of its own: it shows what the teacher's device sends. It loads pictures and audio from `la-media`, so the TV needs internet even when the unit is downloaded on the teacher's device.
- Debug the receiver from a computer on the same network with `chrome://inspect` (registered devices only), or with Google's Cast Command and Control tool.

## TV screen driven by a tablet

- Where the TV cannot run the Cast receiver, `https://la-teacher.passionedu.org/screen` is opened without signing in, either in the TV's own web browser (tested in October 2026 on the classroom Android TV's browser) or on a laptop plugged into the TV (display mode Duplicate). It shows a QR code; the teacher's signed-in tablet scans it in a lesson (Show on TV → TV browser or laptop) and drives the lesson. Both need internet.
- TV browsers are old: the page avoids newer CSS such as `dvh` units, and draws PDFs with the same pdf.js 3 legacy build as the Cast receiver when the browser lacks what pdf.js 6 needs (`apps/teacher/src/lib/pdf-legacy.ts`).
- The API relays the messages (`/api/screens`, server-sent events both ways). The laptop's side is authorised by a secret token it got when opening the screen; only the teacher who paired can send to it. Pairing codes are single use and change every 15 minutes.
- Screens live in the API's memory: **a deploy disconnects every laptop screen** (the laptop shows a new code and the teacher scans again). Deploy outside teaching hours. Screens whose laptop left close after 2 minutes, idle ones after 12 hours, and at most 1,000 can be open.

## Classroom tips

- Teachers should open the Teacher app and download the week's unit the day before; lessons then run without the internet.
- Install the Teacher app with **Install app** in its header: Chrome, Edge and Android open their install prompt, and other browsers show the steps for the device. On iPad this is Safari's Share → **Add to Home Screen**; without it Safari may clear downloaded lessons after a week without use. The installed app keeps its own sign-in, so sign in once more after installing.
