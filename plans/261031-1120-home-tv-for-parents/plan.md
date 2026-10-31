---
title: "Watch on TV at home: parents pair the TV with their phone"
description: "A parent opens littleantsenglish.com → Watch on TV on the home TV, scans its QR code (in the app, or with the phone camera), and the TV plays the child's leaf while the phone is the remote."
status: in-progress
priority: P1
effort: 3d
branch: feat/home-tv
tags: [feature, frontend, backend]
blockedBy: []
blocks: []
created: 2026-10-31
---

# Watch on TV at home: parents pair the TV with their phone

## Decisions (from the user, 2026-10-31)

- Parents can show Listening Time on the home TV through the same TV screen teachers use (`littleantsenglish.com`
  → **Watch on TV** → QR code).
- Scanning: the in-app **Watch on TV** scanner is the main way; the phone camera works too (the QR code is a link).

## Design

```
Home TV browser                        API (/api/screens, in memory)            Parent's phone (Student app)
/screen: QR → littleantsenglish.com/tv/pair?code=…   ◀── pair (parent cookie) ──  in-app scanner or camera link
renders `listen` frames, plays audio  ◀── listen / audio ────────────────────────  Player in remote mode
reports audio-status (time)           ── audio-status ──────────────────────────▶  computes slides, records leaf
```

- **One screen, two kinds of controller.** A screen is paired with a staff user (lesson, as today) or a parent
  (home). The API keys the pairing on `{ kind, id }` and still forwards messages without reading them; parents may
  send only `listen`, `audio` and `end`.
- **The phone runs the player, the TV shows it.** The phone keeps the leaf logic it has today (`ItemRunner`,
  progress, the outbox) and sends the TV a `listen` frame per slide (picture, title, lines, current line, big
  letter, colour). The TV plays the recordings (`audio` messages, already supported) and reports the time back, so
  lyrics follow the TV's sound. The phone shows big remote controls and a small copy of the slide.
- **Device voice** (practice voice where no recording exists) stays on the phone: old TV browsers may have no
  English voice.
- **One QR address for everyone:** `littleantsenglish.com/tv/pair?code=…`. Signed in as staff → the Teacher app's
  pairing; as a parent → home pairing; neither → sign-in, then back. The Teacher app's scanner accepts both
  addresses.
- **Scanner:** `BarcodeDetector` where the browser has it (Android Chrome), otherwise a small QR decoder library
  (iPhone/iPad Safari has no `BarcodeDetector`).

## Outcome and acceptance

- On a home TV browser: `littleantsenglish.com` → **Watch on TV** shows a QR code (unchanged page).
- In the Student app (At home), **Watch on TV** opens the camera; scanning the TV code pairs it within 2 s, on
  Android and on iPhone. Scanning with the phone camera opens `/tv/pair`, which pairs (after sign-in if needed).
- A parent with several children does not pick one when pairing: the TV plays whatever the phone plays, for the
  child chosen in the app as usual.
- Paired: playing a leaf shows its pictures and lyrics on the TV with the TV playing the sound; the phone shows
  Play/Pause, Next, Previous, Again and the part dots. Lyrics highlight within 0.5 s of the TV's sound.
- A leaf played on the TV turns green exactly as on the phone (same progress records).
- **Stop showing on TV** on the phone (and leaving the player for 12 hours) frees the TV; the TV returns to its
  QR code. If the TV disconnects, the phone says so and keeps playing on the phone.
- Teachers' pairing and lessons on the TV work as before, with both old and new QR addresses.
- The TV shows nothing until a parent pairs; another parent cannot take over a paired screen.

Non-goals: Google Cast at home (needs a receiver variant; later), several phones on one TV, the TV choosing
leaves by remote control, offline TV.

## Phases

| # | Phase | Depends on | Effort |
|---|-------|-----------|--------|
| 1 | [API and protocol: parent pairing](phase-01-api-parent-pairing.md) | – | 0.75d |
| 2 | [TV screen: listen frames and the shared QR address](phase-02-tv-screen.md) | 1 | 0.5d |
| 3 | [Student app: pair page, scanner, remote player](phase-03-student-remote.md) | 1, 2 | 1.25d |
| 4 | [Guide, docs and device test](phase-04-guide-device-test.md) | 3 | 0.5d |

## Risks

- **iPhone camera link opens Safari**, whose sign-in is separate from the home-screen app: the pair page signs the
  parent in there; the in-app scanner avoids it. Covered by acceptance on both systems.
- **Audio autoplay on the TV**: TV browsers may block sound until the screen is touched. The existing screen page
  handles this with its Start button; the phone shows "press Start on the TV" when the TV reports `blocked`.
- **Deploys disconnect screens** (in-memory relay), as for classrooms: the phone falls back to playing itself and
  offers to scan again.
- **Two-device limit for parents** is about sign-in sessions; a paired TV is not a signed-in device and does not
  count.

## Progress (2026-10-31)

Phases 1–3 done on `feat/home-tv`; the landing copy and the operations doc were updated as in phase 4. Checked:
API tests (parent routes, a parent and a teacher with the same id kept apart), the TV page's QR code and listen
slide in Playwright at 1920×1080 and at 1280×720 with a Chrome 92 user agent, and the phone side against a mocked
API (pair with a typed code, play a leaf, slides sent to the TV, On TV badge). Left: the device checklist in
phase 4 (real TV browser, Android phone, iPhone).
