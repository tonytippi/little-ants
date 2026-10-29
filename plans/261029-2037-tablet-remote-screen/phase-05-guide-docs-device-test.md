---
phase: 5
title: "Guide, docs and device test"
status: in-progress
priority: P1
effort: "0.5d"
dependencies: [4]
---

# Phase 5: Guide, docs and device test

## Goal

Teachers can set it up alone, and it is proven on the real tablet, laptop and TV.

## Files

- Modify: `apps/teacher/src/app/tv-help/page.tsx` — a "Laptop + tablet" tab first in the list.
- Modify: `docs/operations/deploy-and-restore.md` — the screen relay (in-memory, dropped on API restart, limits).

## Steps

1. Guide tab: plug the laptop into the TV and choose Duplicate; open `la-teacher.passionedu.org/screen` and tap
   Start; on the tablet open the lesson → Show on TV → Laptop screen → scan; both need internet; allow the camera.
2. Operations doc: endpoints are public only for the screen side, codes are single use, screens vanish on deploy.
3. Deploy, then run the device test.

## Device test

- [ ] Laptop `/screen` without sign-in shows QR; Start enters full screen.
- [ ] Android tablet in Chrome, signed in: scan connects; steps, pages, word cards follow in under 1 s.
- [ ] Audio plays through the TV; play, pause, seek from the tablet; position shown.
- [ ] Walk to the back of the classroom: control still works.
- [ ] Open another lesson on the tablet: the TV follows.
- [ ] Wi-Fi off and on for 10 s on the tablet, then on the laptop: both recover.
- [ ] Disconnect: the laptop shows a new QR code.
