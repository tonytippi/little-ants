---
phase: 3
title: "Move to littleantsenglish.com"
status: pending
priority: P1
effort: "1d"
dependencies: [1, 2]
---

# Phase 3: Move to littleantsenglish.com

## Goal

Every app answers on the new domain; the old addresses keep working through redirects during the move.

## Steps

Done by the user in Cloudflare and Google consoles (each listed with exact values when we get there):

1. **Tunnel** public hostnames: `littleantsenglish.com` → student `127.0.0.1:9204`; `teacher.` → 9201;
   `admin.` → 9200; `api.` → 9202 (same ports as today; check `docs/operations/deploy-and-restore.md`).
2. **R2 media bucket**: add custom domain `media.littleantsenglish.com`; keep `la-media.passionedu.org`.
   CORS (`infra/r2-cors.json`): add the new origins to both buckets.
3. **Google OAuth client**: add redirect URIs `https://api.littleantsenglish.com/api/auth/callback/google` and
   `https://api.littleantsenglish.com/api/parent/auth/google/callback`, and the new JavaScript origins.
4. **Google Cast console**: receiver URL → `https://teacher.littleantsenglish.com/cast-receiver/`.

Done in the repository and on this server:

5. `.env.production` (user approves the edit): `ADMIN_HOST`, `TEACHER_HOST`, `API_HOST`, `STUDENT_HOST`,
   `AUTH_COOKIE_DOMAIN=.littleantsenglish.com`, `MEDIA_PUBLIC_BASE_URL=https://media.littleantsenglish.com`.
   Update the defaults in `infra/docker-compose.prod.yml` and `infra/env.production.example`.
6. Code mentions of `la-teacher.passionedu.org` (`tv-menu.tsx`, `qr-scanner.tsx`, `tv-help/page.tsx`,
   `cast-protocol.ts` comment); `infra/r2-cors.json`. Keep the Cast namespace string (protocol id, not a host).
7. Build and deploy (all URLs are baked into the browser bundles).
8. **Redirects** (Cloudflare redirect rules, 301, path and query kept): `la-student.` → root (`/` → `/app`),
   `la-teacher.` → `teacher.` except `/cast-receiver/*` until step 4 is live, `la-admin.` → `admin.`.
   The old API host stays reachable for a few weeks for installed apps that still call it.
9. Republish units when convenient so their media uses the new media domain (optional).

## Verification

- Staff sign-in on Admin and Teacher, parent sign-in on the Student app, At school mode with a staff session.
- Teacher: cast to the TV, laptop `/screen` pairing, second window.
- Student: play a leaf, download for offline (CORS on the new origin).
- Old addresses redirect; Cast still connects during the change.
- Update `docs/operations/deploy-and-restore.md` with the new hostnames.

## Rollback

Restore the previous `.env.production` and redeploy; the old hostnames are still on the tunnel and the bucket.
