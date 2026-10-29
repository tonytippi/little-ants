---
title: Implement the tablet remote for a laptop screen
date: 2026-10-29
summary: "API screen relay, /screen laptop page, in-app QR pairing and shared TV display implemented; deploy awaiting approval"
---

# Implement the tablet remote for a laptop screen

## What happened
Implemented plans/261029-2037-tablet-remote-screen on feat/tablet-remote-screen. The API has an in-memory screen relay (/api/screens: public create and laptop stream authorised by a display token, signed-in pairing with single-use 6-character codes, owner-only sending, SSE both ways with a 20 s heartbeat, sweep of abandoned screens). The Teacher app shares one TvDisplay between the Cast receiver and the new /screen laptop page, sends to whichever TV is connected through useTvLink/sendToTv, and pairs with an in-app BarcodeDetector scanner or a typed code (/screen/pair covers the system camera).

## Decision
- Relayed messages are opaque to the API (type allow-list and 64 KB limit); the display only renders them.
- The laptop reports `blocked` audio when the browser refuses autoplay, and the tablet shows a hint.

## Verification
Monorepo typecheck and lint pass; API 68 tests (6 new for screens), Teacher 26 tests, Teacher production build. SSE through Cloudflare and the device test are not done: the production deploy was blocked by the auto-mode permission check and needs the user's approval.

## Next steps
Commit and deploy after approval, curl the SSE stream through Cloudflare, then run the phase 5 device test.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
