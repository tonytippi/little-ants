---
phase: 6
title: "Guide page, publish and docs"
status: in-progress
priority: P2
effort: "0.5d"
dependencies: [3]
---

# Phase 6: Guide page, publish and docs

## Goal

Teachers can set up casting without help, every classroom TV can run the receiver, and maintainers know how the
receiver is registered.

## Files

- Create: `apps/teacher/src/app/tv-help/page.tsx` — the guide.
- Modify: `apps/teacher/src/lib/links.ts` — `tvHelp()`.
- Modify: `apps/teacher/public/sw.js` — add `/tv-help` to the offline routes.
- Modify: `apps/teacher/src/components/player/tv-menu.tsx` — link to the guide.
- Modify: `docs/operations/deploy-and-restore.md` (or the nearest operations doc) — a short "Google Cast receiver"
  section.

## Steps

1. Guide page with two tabs, in English like the rest of the Teacher app (a multi-language UI is a separate decision):
   - **Chromecast / Android TV:** use Chrome; the TV and the laptop or tablet must be on the same Wi-Fi; tap Show on
     TV → Chromecast and pick the TV by name; if no TV appears: check the Wi-Fi on both, restart the TV, ask the
     school whether the Wi-Fi blocks devices from seeing each other; the TV needs internet to load pictures and
     audio.
   - **Second window (HDMI):** plug the TV into the laptop, tap Show on TV → Second window, drag the window to the TV,
     tap full screen.
2. Publish the receiver in the Google Cast SDK Developer Console after the device gate passes (the user does this;
   publishing takes about 15 minutes to reach all TVs). Until then, register each test TV's serial.
3. Operations doc: app ID `B1587FA6`, receiver URL, who owns the Cast Console account, how to register a test device,
   how to debug the receiver with `chrome://inspect`, and that changing the receiver URL in the console affects all
   TVs.

## Verification

- `/tv-help` opens offline after one visit.
- After publishing: an unregistered classroom TV runs the receiver.
- Docs links and facts checked against `cast.ts` and the console.
