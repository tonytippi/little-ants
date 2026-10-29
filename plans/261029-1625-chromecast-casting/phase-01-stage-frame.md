---
phase: 1
title: "Stage frame"
status: completed
priority: P2
effort: "0.5d"
dependencies: []
---

# Phase 1: Stage frame

## Goal

Describe what children see as one small, self-contained `StageFrame`, so the teacher window, `/present` and the Cast
receiver all render the same thing from the same data.

## Context

- `Stage` (`apps/teacher/src/components/player/stage.tsx`) reads the whole `UnitReleasePayload`: `materials`, `words`,
  `unit.title`, `unit.leadCharacter`.
- `/present` (`apps/teacher/src/app/present/page.tsx`) loads the release itself through `ReleaseGate` and receives only
  `{stepIndex, page, view}` over `BroadcastChannel` (`apps/teacher/src/lib/presenter.ts`).
- A Cast receiver cannot sign in, so it cannot load the release. It must get everything in the message.

## Files

- Modify: `apps/teacher/src/components/player/stage-content.ts` — add `StageFrame` and `buildStageFrame()`.
- Modify: `apps/teacher/src/components/player/stage.tsx` — render from a frame.
- Modify: `apps/teacher/src/lib/presenter.ts` — the `state` message carries a `frame`.
- Modify: `apps/teacher/src/components/player/lesson-player.tsx` — build the frame once, pass it to `Stage` and the
  channel.
- Modify: `apps/teacher/src/app/present/page.tsx` — render the received frame. Keep `ReleaseGate` only for the waiting
  screen cover.
- Modify: `apps/teacher/test/display.test.ts` — frame tests.

## Steps

1. Define the frame:
   ```ts
   export interface StageFrame {
     title: string;                 // material title, step title, "Word cards" or unit title
     view: StageView;
     page: number;
     material: StageMaterial | null; // ReleaseMaterial without teacherNotes, actions, fullText when pages exist
     word: { text: string; image: ReleaseMedia | null } | null;
     wordCount: number;             // so page turning works for word cards
     lead: { name: string; image: ReleaseMedia | null } | null;
   }
   ```
   Strip teacher-only fields (`teacherNotes`, `actions`) and anything the stage does not read.
2. `buildStageFrame(payload, step, view, page)` is pure and lives next to `materialDisplay()`.
3. Change `Stage` to take `frame` instead of `payload`/`step`/`view`/`page`. `MaterialStage`, `WordCards` and
   `StepCard` read from the frame. `onPageCount` stays optional: the teacher window needs it, TV surfaces pass none.
4. `PresenterMessage` `state` becomes `{ type: 'state'; frame: StageFrame }`. `/present` renders `frame` directly.
5. In `LessonPlayer`, `useMemo` the frame from `(payload, step, view, page)` and send it on change, as today.

## Verification

- `pnpm --filter @little-ants/teacher test`: `buildStageFrame` covers pages, images, PDF, text, word cards and a step
  without material; teacher-only fields are absent; `JSON.stringify(frame).length < 32_000` for every material in a
  large fixture.
- `pnpm --filter @little-ants/teacher typecheck` and `lint`.
- Manual: teach a lesson with the TV window open; pages, word cards and steps match as before.
