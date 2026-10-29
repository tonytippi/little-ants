---
phase: 3
title: "Laptop screen page"
status: completed
priority: P1
effort: "1d"
dependencies: [1, 2]
---

# Phase 3: Laptop screen page

## Goal

`/screen` on a laptop plugged into the TV shows a QR code until a tablet pairs, then shows the lesson and plays its
audio. No sign-in.

## Files

- Create: `apps/teacher/src/app/screen/page.tsx`
- Create: `apps/teacher/src/lib/screen-display.ts` — create screen, open the display stream, post status, reconnect.
- Modify: `apps/teacher/src/app/providers.tsx` — like `/cast-receiver`, no outbox on `/screen`.
- Modify: `apps/teacher/src/lib/links.ts` — `screen()`.

## Steps

1. On load, `POST /screens`; keep `{ screenId, displayToken }` in `sessionStorage` so a reload resumes the same
   screen while it exists.
2. Waiting view: large QR code (the `qrcode` package already used by the app) encoding
   `https://la-teacher.passionedu.org/screen/pair?code=XXXXXX`, the code in big letters, and one line: "Open the lesson
   on your tablet → Show on TV → Laptop screen, then scan this code".
3. A "Start (full screen, sound on)" button: enters full screen and plays a silent sound once, so later `play()` calls
   are allowed. Show it until clicked.
4. `EventSource` on the display stream. `paired` shows "Connected to <teacher>" for 3 seconds, then `TvDisplay`.
   `unpaired`, an expired screen (404) or a lost stream for more than 30 seconds create a new screen and show the QR
   again. Send `ready` after each (re)connect so the tablet resends the frame.
5. Keep the screen awake while open (`navigator.wakeLock` when available).

## Verification

- `pnpm --filter @little-ants/teacher typecheck lint test build`.
- Open `/screen` in a private window: QR and code appear without sign-in; reload keeps the code; stopping the API
  shows a new code after it comes back.
