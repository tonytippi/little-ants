---
phase: 4
title: "Audio on the TV"
status: in-progress
priority: P2
effort: "1d"
dependencies: [3]
---

# Phase 4: Audio on the TV

## Goal

While casting, songs, chants and stories play from the TV speakers. The teacher's audio bar controls the TV and shows
its position. Without casting (and in Second window mode) audio plays on the teacher's device as today.

## Files

- Modify: `apps/teacher/src/lib/cast-protocol.ts` — audio messages.
- Modify: `apps/teacher/src/app/cast-receiver/page.tsx` — an `<audio>` element driven by messages.
- Modify: `apps/teacher/src/components/player/audio-bar.tsx` — a remote mode with the same controls.
- Modify: `apps/teacher/src/components/player/lesson-player.tsx` — pass the Cast `send` and audio status to the bar.

## Steps

1. Messages:
   - Sender → TV: `{ type: 'audio'; action: 'load' | 'play' | 'pause' | 'seek' | 'restart'; track?: ReleaseMedia;
     time?: number }`.
   - TV → sender: `{ type: 'audio-status'; trackId: string; playing: boolean; current: number; duration: number }`,
     sent on play/pause/ended/loadedmetadata and every second while playing.
2. Receiver: one `<audio>`. `load` sets `src` and stops; a new frame for another step or page stops audio, matching
   today's "a new step or page stops the audio" rule. Never starts on its own.
3. `AudioBar` gets an optional `remote` prop `{ send, status }`. In remote mode it renders no `<audio>`, sends
   commands, and shows `status` (play state, position, duration). Track selection sends `load`.
4. If the session drops, the bar falls back to local mode on the next step.

## Verification

- `pnpm --filter @little-ants/teacher test`: guards for audio messages; the bar's remote mode sends the right messages
  (pure helper, no DOM audio).
- On the TV: play, pause, seek, restart, switch tracks; position on the tablet stays within 1 s of the TV. Turning
  the page stops the TV audio.
