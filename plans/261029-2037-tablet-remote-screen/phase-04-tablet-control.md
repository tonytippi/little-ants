---
phase: 4
title: "Tablet pairing and control"
status: completed
priority: P1
effort: "1d"
dependencies: [2, 3]
---

# Phase 4: Tablet pairing and control

## Goal

In a lesson, the signed-in tablet scans the laptop's QR code inside the Teacher app and then drives the TV exactly as
with Chromecast.

## Files

- Create: `apps/teacher/src/components/player/qr-scanner.tsx` — camera view with `BarcodeDetector`; a code field as
  fallback.
- Create: `apps/teacher/src/lib/screen-link.ts` — pair, teacher event stream, send, disconnect, remembered pairing.
- Create: `apps/teacher/src/lib/tv-link.ts` — one `useTvLink()` over Cast and the laptop screen: `{ kind, status,
  name, send, onMessage }`.
- Create: `apps/teacher/src/app/screen/pair/page.tsx` — if someone scans with the system camera instead, this page
  pairs (sign-in required) and tells them to go back to the lesson.
- Modify: `apps/teacher/src/components/player/tv-menu.tsx` — "Laptop screen (scan QR)" item; "Disconnect".
- Modify: `apps/teacher/src/components/player/lesson-player.tsx` — send frames and audio through `useTvLink()` instead
  of calling the Cast helpers directly.

## Steps

1. Scanner: `getUserMedia({ video: { facingMode: 'environment' } })`, `BarcodeDetector({ formats: ['qr_code'] })`
   every 300 ms; accept only our `/screen/pair?code=` URLs. No `BarcodeDetector` or camera refused → show the code
   field.
2. `POST /screens/pair` → keep `screenId` in `localStorage`; open the teacher stream with `withCredentials`. A new
   lesson re-opens the stream and sends its first frame (same as the Cast `ready` flow).
3. `useTvLink()` picks the connected transport (Cast or laptop screen, never both) and exposes the same `send` and
   messages. The lesson player's frame resend, remote audio bar and notes-first layout use it unchanged.
4. Status in the menu button: "On TV: Laptop" (or the Cast device name). `audio-status.blocked` shows a hint under the
   audio bar: "Tap the laptop screen once to allow sound". `screen-offline` shows "Laptop screen not connected".
5. "Disconnect" calls `DELETE /screens/:id` and forgets the pairing. Finish lesson sends `end`.

## Verification

- `pnpm --filter @little-ants/teacher typecheck lint test build`; unit tests for the code parsing and the transport
  choice.
- Desktop Chrome with two windows (one private for `/screen`, one signed in): pair by typing the code; steps, pages,
  word cards and audio follow.
