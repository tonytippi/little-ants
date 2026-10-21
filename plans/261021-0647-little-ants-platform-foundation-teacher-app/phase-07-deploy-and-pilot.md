---
phase: 7
title: "Deploy and pilot"
status: pending
priority: P1
effort: "1w + pilot"
dependencies: [5, 6]
---

# Phase 7: Deploy and pilot

## Goal

Run the stack on one VPS behind Cloudflare Tunnel, serve media from R2, back up daily, and pilot Level 1
with real classes.

## Architecture

```
Browser ──► Cloudflare ──► Tunnel (cloudflared) ──► VPS docker compose
                │                                    ├─ api (NestJS)
                │                                    ├─ admin (Next.js standalone)
                │                                    ├─ teacher (Next.js standalone)
                │                                    └─ postgres (volume)
                └─► media.<domain> ──► R2 bucket (approved assets, public, cached)
                    drafts: private R2 keys, signed URLs from the API
```

Hostnames: `api.`, `admin.`, `teacher.`, `media.` on one domain so cookies can be shared (phase 4).

## Tasks and steps

1. `infra/docker-compose.prod.yml` with images built in CI, health checks, restart policies, and resource limits.
2. `cloudflared` container with a token; ingress rules for `api`, `admin`, `teacher`.
3. R2: bucket, custom domain `media.`, CORS for presigned uploads from `admin.`, long cache headers for
   versioned approved keys.
4. Backups: nightly `pg_dump` to R2 with 30-day retention; a tested restore script.
5. Monitoring: uptime check on `/health`, error tracking (for example Sentry), API logs to files with rotation.
6. Deploy script: pull images, run `prisma migrate deploy` after a backup, restart services.
7. Import Units 1–4 into production, sign off, archive the Level 1 Excel and Word files.
8. Pilot: 1–2 classes for 2–4 weeks; collect teacher feedback weekly; fix in short cycles.
9. Update `docs/` with a short deploy and restore runbook.

## Verification

- All hostnames reachable over HTTPS; the media domain serves an approved image with cache hit headers.
- A restore of last night's backup into a fresh database succeeds.
- Pilot exit: teachers ran at least 20 lessons with the app, and no lesson was blocked by an app problem.

## Risks

- Single VPS is a single point of failure. Acceptable for the pilot because the Teacher app runs offline
  after download; backups keep data safe.
- Tunnel or VPS downtime during class. Mitigation: download units the day before.

## Rollback

- Keep the previous image tags; `docker compose up` with the old tag and restore the pre-migration backup.
