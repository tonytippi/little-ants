---
phase: 2
title: "Ink model and messages"
status: completed
priority: P1
effort: "0.5d"
dependencies: []
---

# Phase 2: Ink model and messages

## Goal

One small, framework-free ink model that the teacher's app, the second window, the laptop screen and the plain Cast
receiver all share, and the messages that carry it.

## Files

- Create: `apps/teacher/src/lib/ink.ts`.
- Modify: `apps/teacher/src/lib/cast-protocol.ts` — `ink` and `ink-live` sender messages, `isSenderMessage`.
- Modify: `packages/shared/src/screens.ts` — add `'ink'`, `'ink-live'` to `TEACHER_TO_SCREEN_TYPES` (the API relay
  validates against it).
- Create: `apps/teacher/test/ink.test.ts`.

## Model

```ts
export type InkTool = 'pen' | 'highlighter';
export interface InkStroke {
  id: string;
  tool: InkTool;
  color: string;      // one of INK_COLORS
  width: number;      // fraction of the box width
  points: number[];   // x0, y0, x1, y1 … as fractions of the box, 3 decimals
}
export const INK_COLORS = ['#e5484d', '#2f6fdf', '#2e9e5b', '#1f1a17'];
export const MAX_STROKES = 80;

export function surfaceKey(step: number, view: string, page: number): string;
export function quantise(value: number): number;               // clamp 0..1, 3 decimals
export function simplify(points: number[], tolerance: number): number[]; // Ramer–Douglas–Peucker
export function strokePath(points: number[], width: number, height: number): string; // SVG "M … Q …"
export function capStrokes(strokes: InkStroke[]): InkStroke[];  // keeps the newest MAX_STROKES
```

## Messages

```ts
| { type: 'ink'; key: string; strokes: InkStroke[] }          // whole surface: stroke end, undo, redo, erase, clear, resync
| { type: 'ink-live'; key: string; stroke: InkStroke }        // the stroke being drawn so far (replaces the last live one)
```

`ink-live` sends the whole growing stroke (after simplify) rather than deltas: a lost or reordered message cannot
corrupt it, and the next one repairs it. The TV shows `strokes` of its current key plus at most one live stroke.

## Steps

1. Write `ink.ts` with the functions above. No DOM, no React: it is compiled into the receiver.
2. Add the message types and guards. The receiver tsconfig already compiles files it imports.
3. Add the two types to `TEACHER_TO_SCREEN_TYPES`. The relay's 64 000-character limit stays.
4. Add `surface: string` to `StageFrame` (`buildStageFrame` takes the step index and sets
   `surfaceKey(stepIndex, view, page)`), so every display can match ink to the page it shows.

## Verification

- Tests: `simplify` keeps end points and drops collinear points; `quantise` clamps; `strokePath` scales; a surface of
  `MAX_STROKES` long strokes (200 points each after simplify) serialises under `SCREEN_MESSAGE_LIMIT`;
  `isSenderMessage` accepts `ink` and `ink-live`.
- `pnpm --filter @little-ants/teacher test`, `pnpm --filter @little-ants/api test` (relay accepts the new types).
