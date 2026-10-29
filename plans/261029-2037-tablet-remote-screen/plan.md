---
title: "Tablet remote for a laptop screen"
description: "A laptop plugged into the classroom TV shows a QR code; the teacher's signed-in tablet scans it and drives the lesson on the TV through the API."
status: in-progress
priority: P1
effort: 4.5d
branch: feat/tablet-remote-screen
tags: [feature, frontend, backend, api]
blockedBy: []
blocks: []
created: 2026-10-29
---

# Tablet remote for a laptop screen

Teachers must walk around the classroom with a tablet. Where the TV cannot run our Cast receiver, a laptop plugged
into the TV (display mode **Duplicate**) becomes the screen: it opens a page that needs no sign-in and shows a QR
code. The teacher's **signed-in tablet** scans it in the Teacher app and then teaches exactly as with Chromecast:
notes, steps and audio controls on the tablet; stage and sound on the TV. Messages go through the API over the
internet.

This reuses the Chromecast work (`plans/261029-1625-chromecast-casting`): the same stage frames and audio messages
(`apps/teacher/src/lib/cast-protocol.ts`), the same receiver behaviour, the same remote audio bar and teaching layout.
Only the transport is new.

## Decisions (from the user, 2026-10-29)

- Messages go over the internet through the API (no direct LAN link).
- The tablet is signed in (it has the camera and scans the QR). The laptop may or may not be signed in; the screen
  page needs no sign-in.
- The laptop only mirrors the TV (Duplicate); it does not show notes.

## Design

```
Tablet (signed in, LessonPlayer)             API (in-memory screen relay)            Laptop /screen (no sign-in) → HDMI → TV
  scan QR / type code ── POST /screens/pair ─▶ binds screen to this teacher
  frame, audio cmds ──── POST /screens/:id/messages ─▶ SSE /screens/:id/display-events ─▶ renders stage, plays audio
  ◀─ SSE /screens/:id/events ◀── POST /screens/:id/display-messages ◀── ready, audio-status
```

- A screen has an id, a secret display token (only the laptop knows it) and a one-time pairing code shown as QR and
  as 6 easy characters. Only the teacher who paired can send to it.
- The relay forwards messages without reading them, except for type and size checks. The screen renders only what it
  receives, like the Cast receiver. Approved media are public on `la-media`, so the laptop needs no sign-in.

## Outcome and acceptance

- On a laptop, `https://la-teacher.passionedu.org/screen` shows a big QR code and a 6-character code, with no sign-in.
- In a lesson on the tablet, Show on TV → Laptop screen opens the camera in the app; scanning the QR (or typing the
  code) connects within 2 seconds. The TV then follows steps, pages and word cards in under 1 second.
- Audio plays from the laptop (so through the TV). Play, pause and seek on the tablet control it and show its
  position.
- While connected, the tablet uses the notes-first layout from the Chromecast plan.
- The pairing survives opening another lesson and short network drops on either device; "Disconnect" on the tablet
  returns the laptop to its QR code.
- Nobody else can drive the screen: a code works once, a screen accepts messages only from the teacher who paired, and
  unpaired screens expire.
- The guide `/tv-help` explains the laptop + tablet setup.

Non-goals: working without internet, more than one controlling tablet per screen, showing notes on the laptop,
recording or attendance through the laptop, a native app.

## Phases

| # | Phase | Depends on | Effort |
|---|-------|-----------|--------|
| 1 | [Shared TV display](phase-01-shared-tv-display.md) | – | 0.5d |
| 2 | [Screen relay in the API](phase-02-screen-relay-api.md) | – | 1.5d |
| 3 | [Laptop screen page](phase-03-laptop-screen-page.md) | 1, 2 | 1d |
| 4 | [Tablet pairing and control](phase-04-tablet-control.md) | 2, 3 | 1d |
| 5 | [Guide, docs and device test](phase-05-guide-docs-device-test.md) | 4 | 0.5d |

## Risks

- Browsers block sound until someone touches the page. The laptop page asks for one click (it also enters full
  screen) and tells the tablet when sound is blocked.
- Cloudflare closes idle connections after about 100 seconds; the event streams send a heartbeat every 20 seconds.
- Screens live in API memory: an API restart (deploy) drops them, and the laptop shows a new QR code. Acceptable for
  one API instance; a second instance would need a shared store.
- The tablet needs Chrome with the camera allowed for `la-teacher.passionedu.org`; typing the code is the fallback.
