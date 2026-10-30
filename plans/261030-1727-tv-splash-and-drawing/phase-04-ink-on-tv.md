---
phase: 4
title: "Ink on the TV displays"
status: completed
priority: P1
effort: "1d"
dependencies: [1, 2, 3]
---

# Phase 4: Ink on the TV displays

## Goal

The second window, the laptop screen and the Cast receiver on old TVs show the teacher's drawing on the same spot
of the picture or page.

## Files

- Modify: `apps/teacher/src/lib/presenter.ts` — `ink` and `ink-live` on the BroadcastChannel (or reuse the sender
  message types).
- Modify: `apps/teacher/src/app/present/page.tsx` — keep ink state; read-only `InkLayer` in `Stage`.
- Modify: `apps/teacher/src/components/tv-display.tsx` — same for the laptop screen.
- Modify: `apps/teacher/cast-receiver/receiver.ts`, `apps/teacher/public/cast-receiver/receiver.css` — plain DOM
  content box and SVG ink layer using `lib/ink.ts`.

## Steps

1. Display state: `{ key, strokes, live }`. A frame whose surface key differs from the ink key hides the ink until
   the matching `ink` message arrives (the teacher sends it on every surface change). `ink-live` with the current key
   replaces `live`; `ink` replaces `strokes` and clears `live`.
2. Displays read the surface key from `StageFrame.surface` (added in phase 2) to match ink to the page they
   show.
3. Receiver: wrap picture and PDF canvas in a box with the content's aspect ratio (same rule as phase 3), add an
   `<svg>` overlay, redraw paths on ink messages and on resize. Ink redraws must not re-render the picture or PDF
   (keep the `shown` cache).
4. Splash frames hide the ink layer.

## Verification

- `pnpm --filter @little-ants/teacher typecheck lint test build` (the build compiles the receiver).
- Locally: second window and `/screen` with a second browser; draw on a picture, a PDF page and a word card; turn
  pages back and forth; reload the TV page and check the drawing returns.
- Cast probe tools in `/tmp/cast-probe/` can send an `ink` message to the TV for a quick check before the full device
  test.
