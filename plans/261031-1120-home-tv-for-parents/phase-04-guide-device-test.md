---
phase: 4
title: "Guide, docs and device test"
status: in-progress
priority: P2
effort: "0.5d"
dependencies: [3]
---

# Phase 4: Guide, docs and device test

## Files

- Modify: landing copy (`apps/student/src/components/landing/landing-copy.ts`) — add "Show it on the TV and sing
  together" to Listening Time points (VI + EN), now true.
- Modify: `docs/operations/deploy-and-restore.md` — TV section: parents pair too; QR address; what a deploy does.

## Device checklist

- Home Android TV browser + Android phone: in-app scan, camera scan, play a leaf, Next, Stop, leaf turns green.
- Same with an iPhone (Safari camera link and the home-screen app's scanner).
- Classroom: teacher scans the new QR code with the Teacher app; lesson, Hide on TV and drawing still work.
- Deploy while paired: phone falls back to local playback and offers to scan again.

## Verification

- All gates: `pnpm turbo lint typecheck test build`, `pnpm format:check`. Deploy after the user approves.
