---
phase: 3
title: "Student app: pair page, scanner, remote player"
status: completed
priority: P1
effort: "1.25d"
dependencies: [1, 2]
---

# Phase 3: Student app: pair page, scanner, remote player

## Goal

A parent pairs the TV from the app or with the phone camera, then plays leaves on the TV with the phone as remote.

## Files

- Create: `apps/student/src/app/(app)/tv/pair/page.tsx` — reads `code`; staff session → redirect to
  `${TEACHER_APP_URL}/screen/pair?code=…`; parent → choose child (if several) and pair; nobody → `/signin` with
  return to this page.
- Modify: `apps/student/src/app/(app)/tv/route.ts` — stays the redirect to the TV screen.
- Create: `apps/student/src/components/tv/tv-scanner.tsx` — camera with `BarcodeDetector`, else a QR decoder
  library (pick a small maintained one, e.g. `jsqr`, loaded only when the scanner opens); typed code as fallback.
- Create: `apps/student/src/lib/tv-link.ts` — pair, event stream, message outbox (same pattern as
  `apps/teacher/src/lib/screen-link.ts`: one request at a time, newest `listen` frame replaces a queued one),
  remembered screen for the session.
- Modify: `apps/student/src/lib/player-runner.ts` — audio through an interface so the runner can drive the local
  `<audio>` or the TV (`load`/`play`/`pause`, time from `audio-status`).
- Modify: `apps/student/src/components/player/player.tsx` — when a TV is paired: send `listen` frames on every
  slide, remote layout (small slide, big controls, "On TV" badge, **Stop showing on TV**); fall back to local
  playback when the TV goes offline.
- Modify: `apps/student/src/components/home-mode.tsx` / header — **Watch on TV** button (At home only), TV status.
- Tests: `apps/student/test/` — frame building from a slide; runner with a fake TV audio; outbox replacement.

## Steps

1. TV link library and runner audio interface (tests first for the runner).
2. Pair page and scanner.
3. Player remote mode and the Watch on TV entry.
4. Playwright: two pages (TV screen + phone) against a local API: pair, play a leaf, Next, Stop.

## Verification

- `pnpm --filter @little-ants/student typecheck lint test build`; the two-page Playwright run; iPhone Safari
  check by the user (scanner fallback and the camera link).
