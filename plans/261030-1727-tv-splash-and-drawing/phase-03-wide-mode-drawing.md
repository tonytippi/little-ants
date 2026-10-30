---
phase: 3
title: "Wide mode and drawing on the teacher's device"
status: completed
priority: P1
effort: "1.5d"
dependencies: [2]
---

# Phase 3: Wide mode and drawing on the teacher's device

## Goal

A full-screen stage on the teacher's device with a pen toolbar; strokes are anchored to the picture or page and kept
per surface for the lesson. Works with or without a TV.

## Files

- Create: `apps/teacher/src/components/player/ink-layer.tsx` — SVG overlay; read-only or editable.
- Create: `apps/teacher/src/components/player/ink-toolbar.tsx`.
- Create: `apps/teacher/src/components/player/wide-stage.tsx` — full-screen view: stage, ink, toolbar, page
  arrows, Hide/Show on TV, exit.
- Create: `apps/teacher/src/lib/use-ink.ts` — per-surface strokes, undo/redo stacks, live stroke; calls `send`.
- Modify: `apps/teacher/src/components/player/stage.tsx` — `ContentBox` wraps media so the ink layer covers
  exactly the shown content; `Stage` takes `ink?: ReactNode` placed inside that box.
- Modify: `apps/teacher/src/components/player/pdf-page.tsx` — report the page's aspect ratio.
- Modify: `apps/teacher/src/components/player/lesson-player.tsx` — **Wide** button, `useInk`, ink sync effects.

## Steps

1. **ContentBox.** For a picture: once loaded, the wrapper gets `aspect-ratio: naturalWidth / naturalHeight` and
   `max-width/max-height: 100%`; the image fills it. For a PDF page: the same from the page viewport. For text,
   step cards and word cards without a picture: a 16:9 box. The ink layer is `absolute inset-0` inside the box.
2. **InkLayer.** `<svg viewBox="0 0 W H">` sized from the box (ResizeObserver). Pens: round caps,
   `stroke-width = width × W`. Highlighter: wider, 35% opacity. Editable mode: Pointer Events with
   `touch-action: none`, `setPointerCapture`; points converted to fractions of the box; once a `pen` pointer is
   seen, `touch` pointers do not draw (palm).
3. **useInk.** `Map<surfaceKey, InkStroke[]>`, undo/redo per surface, eraser removes the stroke under the pointer
   (hit test on simplified points, tolerance about 2% of width). Stroke end, undo, redo, erase and clear call
   `send({ type: 'ink', key, strokes: capStrokes(...) })`; while drawing, `send({ type: 'ink-live', ... })` at most
   every 60 ms.
4. **Wide stage.** Fixed full-screen layer with `requestFullscreen()` where available (Esc or the exit button leaves).
   Toolbar at the bottom: 4 pen colours, highlighter, eraser, a "move" tool (no drawing; swipe turns pages), undo,
   redo, clear page. Top right: ◀ ▶, page count, Hide/Show on TV when a TV is connected, Exit.
5. **LessonPlayer.** **Wide** button in the header and the `W` key. Outside wide mode the stage shows ink
   read-only, and swipe works as before. Send ink: on surface change and on TV `ready`, send `ink` for the current
   surface (skipped while hidden; on Show, send it again).
6. The notes-first layout with a TV is unchanged; wide mode covers it while open.

## Verification

- Tests: content box mapping (a point at the picture's centre is `0.5, 0.5` for different box shapes);
  `useInk` undo/redo/erase/clear per surface (hook tested through its pure reducer).
- Manual on a laptop (mouse), an Android tablet (finger, stylus if available) and in Chrome device emulation.
- `pnpm --filter @little-ants/teacher typecheck lint test build`.
