---
title: Implement Chromecast casting in the Teacher app
date: 2026-10-29
summary: "Cast receiver, sender, TV audio, notes-first layout and TV guide implemented; device gate pending"
---

# Implement Chromecast casting in the Teacher app

## What happened
Implemented plans/261029-1625-chromecast-casting on branch feat/chromecast-casting. The stage now renders from a self-contained StageFrame (teacher-only notes stripped), shared by the teacher window, /present and the new /cast-receiver page (Cast Web Receiver, app B1587FA6, namespace urn:x-cast:org.passionedu.littleants). The lesson player has a Show on TV menu (Chromecast or second window), plays audio on the TV with remote controls, switches to a notes-first layout with adjustable note size while a TV is connected, and links to a new /tv-help guide. No API change.

## Decision
- Hand-written minimal typings for the Cast sender and receiver SDKs instead of @types packages, because both declare a conflicting global `cast`.
- The TV re-requests the current frame with a `ready` message on start or reconnect; the audio bar reloads the current track on that signal.

## Verification
Teacher typecheck, lint, 25 unit tests and the production build pass. Not yet tested on a real Android TV or Android tablet.

## Next steps
Deploy, register a test TV serial, run the phase 3 device gate, then publish the receiver.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
