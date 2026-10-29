---
title: "Chromecast casting for the Teacher app"
description: "Teachers cast the lesson stage to a classroom Android TV with Google Cast while notes stay on their laptop or tablet."
status: in-progress
priority: P2
effort: 5d
branch: feat/chromecast-casting
tags: [feature, frontend]
blockedBy: []
blocks: []
created: 2026-10-29
---

# Chromecast casting for the Teacher app

Teachers teach from a laptop or an Android tablet. Classrooms have Android TVs with Google Cast built in. Like
GrapeSEED Nexus, the teacher taps "Show on TV", picks the TV, and the TV shows only what children see while the
teacher's screen keeps the notes. The app already has a second-window presenter (`/present`, `BroadcastChannel`); this
plan adds Google Cast as a second transport for the same stage.

## Decisions (from the user, 2026-10-29)

- Google Cast custom Web Receiver. App ID `B1587FA6` (registered, not yet published), receiver URL
  `https://la-teacher.passionedu.org/cast-receiver`.
- Audio plays on the TV while casting; the teacher controls it from their screen.
- While a TV is connected, the teaching screen switches to a "teaching with TV" layout: notes always visible and
  larger, stage shown as a smaller preview, adjustable note text size.
- Keep the second-window mode (laptop + HDMI) next to Chromecast.
- A short in-app guide "Show lessons on a TV", like Nexus's casting setup steps. In English, like the rest of the
  app; bilingual content waits until the app itself supports several languages.

## Key design choice

The TV gets a **stage frame**: a small, self-contained snapshot of what children see (title, current material with
public media URLs, page, current word card). The receiver renders frames and needs no login, no API call and no
change to the API. Approved media are already public on `la-media`; draft media in preview carry signed URLs.
Teacher-only text (notes, tips, actions) is stripped from the frame.

## Outcome and acceptance

- On Chrome (laptop or Android tablet) on the same Wi-Fi as the TV, the teacher taps Show on TV → Chromecast, picks the
  TV, and within a few seconds the TV shows the current step. Next/back, page turns, word cards and step jumps appear
  on the TV in under 1 second.
- Audio plays from the TV speakers. Play, pause, restart, seek and track choice on the teacher's screen control it; the
  teacher sees the TV's play position.
- While connected, the teaching screen shows the notes beside a stage preview on a landscape tablet (1000–1340 CSS px
  wide) without opening an overlay; note text size can be changed and is remembered.
- Leaving and reopening the lesson, or a short Wi-Fi drop, resumes the same TV session and resends the current frame.
- Stop casting returns the TV to its home screen. The second-window mode works as before.
- Browsers without Cast (Firefox, Safari) see only the second-window option and a link to the guide.
- The guide page explains same Wi-Fi, how to pick the TV, and what to try when no TV appears.

Non-goals: casting from browsers other than Chrome, a TV app (APK), pairing by code through the server, video
materials, offline casting (the TV loads media from the internet), changing the API.

## Phases

| # | Phase | Depends on | Effort |
|---|-------|-----------|--------|
| 1 | [Stage frame](phase-01-stage-frame.md) | – | 0.5d |
| 2 | [Cast receiver page](phase-02-cast-receiver.md) | 1 | 1d |
| 3 | [Cast sender in the lesson player](phase-03-cast-sender.md) | 1, 2 | 1d |
| 4 | [Audio on the TV](phase-04-audio-on-tv.md) | 3 | 1d |
| 5 | [Teaching layout while casting](phase-05-casting-layout.md) | 3 | 1d |
| 6 | [Guide page, publish and docs](phase-06-guide-publish-docs.md) | 3 | 0.5d |

**Device gate after phase 3:** before phases 4–6, test on a registered Android TV with Chrome on a laptop and on an
Android tablet (checklist in phase 3). If Chrome on Android cannot find the TV, stop and decide the fallback with the
user.

## Risks

- Chrome on Android may not show the TV, or the school Wi-Fi isolates clients. The device gate catches both early.
- pdf.js may be slow on the TV's Cast runtime. Phase 2 measures the first page render time on the real TV.
- Until the receiver is published, only TVs whose serial is registered in the Cast Console can run it.
- Cast custom messages are limited in size (about 64 KB); the frame test asserts that every material stays well below.

## Progress (2026-10-29)

All six phases are implemented on `feat/chromecast-casting`; typecheck, lint, 25 unit tests and the production build
pass. Phases 2–6 stay in progress until the device gate (phase 3) runs on a registered Android TV and the receiver is
published in the Cast Console.
