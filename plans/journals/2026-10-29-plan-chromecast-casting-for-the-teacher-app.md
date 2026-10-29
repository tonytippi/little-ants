---
title: Plan Chromecast casting for the Teacher app
date: 2026-10-29
summary: Chose Google Cast custom receiver with self-contained stage frames; plan in plans/261029-1625-chromecast-casting
---

# Plan Chromecast casting for the Teacher app

## What happened
Studied GrapeSEED Nexus (App Store listing, user screenshots of its Casting Provider settings and Chromecast setup guide). Nexus offers Chromecast plus Windows/Mac casting software and requires the tablet and Chromecast on the same Wi-Fi. Registered Google Cast receiver app B1587FA6 (unpublished) pointing at https://la-teacher.passionedu.org/cast-receiver.

## Decision
- Google Cast custom Web Receiver as the main TV path; keep the existing second-window (HDMI) mode.
- The TV receives a self-contained stage frame (current material with public media URLs, page, word card), so the receiver needs no login and the API does not change. Teacher-only text is stripped.
- Audio plays on the TV while casting, controlled from the teacher's audio bar.
- While a TV is connected, the teaching screen puts notes first with a stage preview and adjustable note size.
- Device gate after the sender phase: if Chrome on Android tablets cannot find the TV, stop and revisit the fallback.

## Next steps
Implement phases 1-3, run the device gate on a registered Android TV, then audio, layout and the guide page.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
