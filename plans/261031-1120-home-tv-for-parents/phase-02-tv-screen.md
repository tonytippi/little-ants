---
phase: 2
title: "TV screen: listen frames and the shared QR address"
status: completed
priority: P1
effort: "0.5d"
dependencies: [1]
---

# Phase 2: TV screen: listen frames and the shared QR address

## Goal

The TV screen page shows the new QR address and, when a parent drives it, a full-screen listening slide with sound.

## Files

- Modify: `apps/teacher/src/app/screen/page.tsx` — QR encodes `screenPairUrl(STUDENT_APP_URL, code)`; the code is
  still shown as text; "Paired with …" text for parents ("Connected to <name>'s phone").
- Create: `apps/teacher/src/components/screen/listen-slide.tsx` — picture faded into the page, title, lyrics with
  the current line highlighted and kept in view, big letter; colour from the frame. Old-browser safe (no `dvh`,
  same approach as `tv-display`), fills a 16:9 TV without scrollbars.
- Modify: the screen's message handling (`useReceivedInk` sibling in the screen display) — `listen` replaces the
  stage frame view; `end` returns to the QR code; `audio` and `audio-status` reuse the existing audio player.
- Tests: `apps/teacher/test/display.test.ts` — `listen` frames accepted, unknown fields ignored.

## Steps

1. QR address and pairing text.
2. Listen slide component and switching between stage and listen views.
3. Check in Playwright with a Chrome 92 user agent at 1920×1080 and 1280×720.

## Verification

- Teacher tests and lint; screenshot check of the listen slide at TV sizes; classroom pairing still works by
  scanning the new QR code with the Teacher app.
