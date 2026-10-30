---
phase: 1
title: "Hide on TV (splash)"
status: completed
priority: P1
effort: "1d"
dependencies: []
---

# Phase 1: Hide on TV (splash)

## Goal

The teacher hides the stage on the TV behind the Little Ants logo and shows it again, on all three TV paths, without
the hidden content ever reaching the TV.

## Files

- Modify: `apps/teacher/src/components/player/stage-content.ts` — `splash?: boolean` on `StageFrame`;
  `splashFrame(frame)` returns `{ title: '', stepTitle: '', view: 'material', page: 0, material: null, word: null,
  wordCount: 0, lead: null, splash: true }`.
- Modify: `apps/teacher/src/components/player/stage.tsx` — `frame.splash` renders `<Splash />` (logo on cream).
- Modify: `apps/teacher/src/components/player/lesson-player.tsx` — `hidden` state; `tvFrame` used for
  `sendToTv` and the BroadcastChannel; button and label; pause audio on hide.
- Modify: `apps/teacher/src/components/player/audio-bar.tsx` — `pauseSignal?: number` prop: when it changes, pause
  the local element or send `{ type: 'audio', action: 'pause' }` in remote mode.
- Modify: `apps/teacher/cast-receiver/receiver.ts`, `apps/teacher/public/cast-receiver/receiver.css` — splash
  view.
- Create: `apps/teacher/public/logo.png` (copy of `apps/student/public/logo.png`).
- Tests: `apps/teacher/test/display.test.ts`.

## Steps

1. Add `splash` and `splashFrame` to `stage-content.ts`. `splashFrame` drops every field that shows content.
2. `Stage` renders the logo full size, centred, with nothing else, when `frame.splash`. `/present` and `/screen`
   use `Stage`, so they follow.
3. Receiver: in `render`, a splash frame shows the same logo; the `shown` key includes `splash` so hide → show
   re-renders.
4. `LessonPlayer`: `const [hidden, setHidden] = useState(false)`; `tvFrame = hidden ? splashFrame(frame) : frame`
   (memoised). Replace `frame` with `tvFrame` in the BroadcastChannel and `sendToTv` effects, so resync (`ready`)
   also sends the splash.
5. Button **Hide on TV** / **Show on TV** in the header, shown only when `withTv`; keyboard shortcut `H` (ignored
   in inputs, like the other keys). While hidden, the teacher's stage shows a small "Hidden on TV" badge over the
   corner; the stage itself keeps the real frame.
6. Pressing Hide increments `pauseSignal`; `AudioBar` pauses (second window: the teacher's device plays; Cast and
   laptop: the TV plays). Showing again does not resume.
7. Hidden state is per lesson page load (starts shown).

## Verification

- Unit tests: `splashFrame` keeps no material, word, lead or titles; a frame built for a step with a material and
  then passed through `splashFrame` has `material === null`.
- `pnpm --filter @little-ants/teacher typecheck lint test build`.
- Manual: second window and laptop screen locally; Cast on the TV in phase 5.

## Risk and rollback

Frontend only; revert the commit. No API or data change.
