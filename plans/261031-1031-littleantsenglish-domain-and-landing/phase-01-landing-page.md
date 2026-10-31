---
phase: 1
title: "Landing page and the app at /app"
status: completed
priority: P1
effort: "1.5d"
dependencies: []
---

# Phase 1: Landing page and the app at /app

## Goal

The Student app's root becomes a fast, server-rendered landing page in Vietnamese (`/`) and English (`/en`); the
listening app moves to `/app`.

## Files

- Move: `apps/student/src/app/page.tsx` → `apps/student/src/app/app/page.tsx` (the `ListeningApp`).
- Create: `apps/student/src/app/(landing)/page.tsx` (VI) and `apps/student/src/app/(landing)/en/page.tsx` (EN),
  sharing `apps/student/src/components/landing/landing-page.tsx` and a copy module
  `apps/student/src/components/landing/landing-copy.ts` (`{ vi, en }`, text from
  [landing-copy.md](landing-copy.md)).
- Create: `apps/student/public/landing/*.webp` — lineup, talk scene, story cover, Move & Do card, unit cover,
  resized (≤ 1600 px wide, WebP), plus `og-image.jpg` 1200×630.
- Modify: `apps/student/public/manifest.webmanifest` — `start_url: "/app"`.
- Modify: `apps/student/public/sw.js` — routes `/app`, `/signin`; offline fallback for `/app`; the landing page
  is not needed offline.
- Modify: links and redirects that point at `/`: sign-in `parentSignInUrl('/')` → `/app`, sign-out, the API's
  parent callback default (`STUDENT_APP_URL` + `/app`), `useRouter` redirects in `listening-app.tsx`.
- Modify: `apps/student/src/lib/hooks.ts` — remember "signed in on this device" (`localStorage`) when a parent or
  staff `me` loads; clear it on 401 and on sign-out.

## Steps

1. Move the app to `/app`; update every internal link and redirect; keep `/signin`.
2. Landing component: hero (lineup, headline, Sign in + Watch on TV), three levels, three learning cards with
   pictures, Listening Time, how to start, footer with the VI | EN switch. Brand fonts, colours and crayon look
   from `@little-ants/ui`; big tap targets; works at 360 px wide and on a TV browser.
3. Language: `/` is Vietnamese (`lang="vi"`), `/en` English, each with its own root layout so `<html lang>` is
   right without JavaScript. The switch stores the choice; `/` sends a visitor who chose English to `/en`. No
   `Accept-Language` redirect: many Vietnamese parents use phones set to English. `hreflang` alternates on both.
4. Signed-in shortcut: a tiny inline script in the landing `<head>` goes to `/app` when the device flag is set,
   before paint. (Parent cookies live on the API host, so the server cannot see them.)
5. Metadata: title, description, Open Graph image per language.
6. Buttons: **Sign in** → `/signin`; **Watch on TV** → `/tv` (phase 2).

## Verification

- Playwright: `/` and `/en` render with no JS errors at 360×740, 820×1180, 1366×768 and 1920×1080 with no
  horizontal scroll; flag set → `/` lands on `/app`; installed start URL `/app` works offline after one visit.
- Lighthouse mobile on `/`: performance ≥ 90, accessibility ≥ 95.
- `pnpm --filter @little-ants/student typecheck lint test build`; `pnpm format:check`.

## Result

Done on branch `feat/landing-page`: route groups `(app)` (app, signin, tv), `(landing-vi)`, `(landing-en)`; the
landing has no React Query or service worker code. `/tv` from phase 2 was added too, since the button needs it.
Checked with Playwright at 360, 820, 1366 and 1920 px (no JS errors, no horizontal scroll), the stored language,
the signed-in shortcut and the `/tv` redirect. Lighthouse not run (no Lighthouse on this host).
