---
phase: 3
title: "Cast sender in the lesson player"
status: in-progress
priority: P2
effort: "1d"
dependencies: [1, 2]
---

# Phase 3: Cast sender in the lesson player

## Goal

From the teaching screen, the teacher chooses Show on TV → Chromecast or Second window, and the chosen TV follows the
lesson.

## Files

- Create: `apps/teacher/src/lib/cast.ts` — load the Web Sender SDK once, `useCast()` hook with availability, session
  state, device name, `start()`, `stop()`, `send()`, and a listener for TV messages.
- Create: `apps/teacher/src/components/player/tv-menu.tsx` — the Show on TV button and its menu.
- Modify: `apps/teacher/src/components/player/lesson-player.tsx` — replace the current TV button; send frames to the
  Cast session as well as the TV window.

## Steps

1. `cast.ts`:
   - Add the sender script `https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1` only on the
     teaching screen, and only in Chrome; elsewhere `available` is false.
   - `window.__onGCastApiAvailable` → `CastContext.getInstance().setOptions({ receiverApplicationId: 'B1587FA6',
     autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED })`. The app ID is public and lives in this file as a
     constant.
   - Track `SESSION_STATE_CHANGED` and `CAST_STATE_CHANGED` (`NO_DEVICES_AVAILABLE`, `NOT_CONNECTED`, `CONNECTING`,
     `CONNECTED`). Expose the TV's friendly name.
   - `start()` calls `requestSession()` (Chrome shows its device picker). `stop()` sends `end`, then ends the session
     so the TV goes back to its home screen.
2. Lesson player:
   - Send `{type:'frame'}` whenever the frame changes and the session is connected; resend on `ready` from the TV.
   - With `ORIGIN_SCOPED`, opening another lesson re-joins the running session; the new lesson sends its first frame.
   - Leaving the lesson does not stop casting. Finish lesson sends `end`.
3. TV menu:
   - Chromecast (shown when `available`; disabled with "No TV found on this Wi-Fi" when no devices) and Second window
     (the existing `openTv()`).
   - When connected: "On TV: <name>" and Stop. A link to the guide (phase 6).
4. A shared `tvConnected` flag (Cast connected or TV window says hello) feeds phase 5's layout.

## Device gate (before phases 4–6)

On the school Wi-Fi with the registered Android TV:

- [ ] Laptop, Chrome: TV appears in the picker, casting starts, steps and pages follow in under 1 s.
- [ ] Android tablet, Chrome: same.
- [ ] Re-open another lesson: casting continues with the new lesson.
- [ ] Wi-Fi off and on for 10 s on the tablet: session resumes, frame resent.
- [ ] Stop: TV returns to its home screen.
- [ ] Firefox: only Second window is offered.

If the tablet cannot find the TV, stop here and decide the fallback with the user.

## Verification

- `pnpm --filter @little-ants/teacher typecheck`, `lint`, `test` (unit-test the message guard and frame resend logic
  that do not need the SDK).
- The device gate above.
