---
phase: 1
title: "Shared TV display"
status: completed
priority: P1
effort: "0.5d"
dependencies: []
---

# Phase 1: Shared TV display

## Goal

One component renders frames and plays audio for any TV transport, so the Cast receiver and the laptop screen behave
the same.

## Files

- Create: `apps/teacher/src/components/tv-display.tsx`
- Modify: `apps/teacher/src/app/cast-receiver/page.tsx` — keep only the Cast SDK wiring.

## Steps

1. Move the frame state, the `<audio>` element, `runAudio`, the status reports and the waiting screen from
   `cast-receiver/page.tsx` into `TvDisplay`.
2. `TvDisplay` props: `connect(handlers: { onMessage(message: SenderMessage): void; onIdle(): void }): () => void`
   and `send(message: ReceiverMessage): void`, plus an optional `waiting` node so the laptop page can show its QR
   code instead of the default waiting screen.
3. Add `{ type: 'audio-status', ..., blocked?: boolean }`: when `play()` is refused by the browser, report
   `blocked: true` so the tablet can say "Tap the laptop screen once to allow sound".
4. The Cast receiver passes a `connect` that registers the custom message listener and sender events, and a `send`
   that calls `sendCustomMessage`.

## Verification

- `pnpm --filter @little-ants/teacher typecheck lint test build`.
- The TV probe from the Chromecast plan still launches `/cast-receiver` once the TV accepts the app.
