---
phase: 5
title: "Guide, docs and device test"
status: completed
priority: P1
effort: "0.5d"
dependencies: [4]
---

# Phase 5: Guide, docs and device test

## Goal

Teachers know how to hide the TV and draw; the features are checked on the classroom devices.

## Files

- Modify: `apps/teacher/src/app/tv-help/page.tsx` — short "Hide the TV" and "Draw on the stage" sections (English).
- Modify: `docs/operations/deploy-and-restore.md` — one line each in the TV section: splash sends no content; ink
  messages go through the same paths.

## Device checklist

- Casper TV with Google Cast: Hide → logo, sound pauses; turn steps; Show → current stage. Draw on a song poster, a
  story page with a PDF and a word card; check placement and latency.
- Laptop screen + Android tablet (scan QR): the same, plus drawing with a finger while walking.
- Second window on a laptop over HDMI (extended display): the same.
- Wide mode on a laptop with no TV: draw, undo, redo, erase, clear, turn pages and back.
- After a TV reconnect (stop and start casting; reload `/screen`): stage and current drawing come back; if hidden,
  the logo stays.

## Verification

- All gates: `pnpm turbo lint typecheck test build` and `pnpm format:check`.
- Deploy after the user approves; remember the TV keeps the old receiver until casting is stopped and started again.
