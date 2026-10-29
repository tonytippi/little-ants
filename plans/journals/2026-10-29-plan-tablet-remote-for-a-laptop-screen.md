---
title: Plan tablet remote for a laptop screen
date: 2026-10-29
summary: Laptop on the TV shows a QR; the signed-in tablet pairs and drives the lesson through an API relay
---

# Plan tablet remote for a laptop screen

## What happened
Chromecast testing on the Casper Android TV (ATV R2, Cast 3.72) stalled: a direct Cast v2 probe from the server showed the TV runs other custom receivers but still reports B1587FA6 as APP_UNAVAILABLE / LAUNCH_ERROR NOT_FOUND after registering the Cast serial and publishing, while Google's app config endpoint already serves the app. Teachers also need to walk around with a tablet, so a fallback without Cast is needed.

## Decision
Plan plans/261029-2037-tablet-remote-screen: a laptop in Duplicate mode opens /screen (no sign-in) and shows a QR code; the signed-in tablet scans it in the Teacher app and sends the same stage frames and audio messages as with Cast, relayed by the API (in-memory screens, SSE both ways, single-use pairing codes, owner-only sending). Internet is required.

## Next steps
Implement the five phases, then run the device test with the real tablet, laptop and TV. Keep probing the TV for B1587FA6.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
