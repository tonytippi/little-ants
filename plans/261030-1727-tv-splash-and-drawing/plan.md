---
title: "Hide the lesson on the TV, and draw on the stage"
description: "The teacher hides the stage on the TV behind the Little Ants logo, and draws on pictures and pages in a full-screen wide mode, shown on the TV too."
status: completed
priority: P1
effort: 4.5d
branch: feat/tv-splash-and-drawing
tags: [feature, frontend]
blockedBy: []
blocks: []
created: 2026-10-30
---

# Hide the lesson on the TV, and draw on the stage

Two features from GrapeSEED Nexus for the Teacher app's lesson player:

1. **Hide on TV (splash).** The teacher hides what children see: the TV shows the Little Ants logo while the
   teacher's own screen keeps the lesson, so they can move to the next item or find a page without children seeing.
2. **Wide mode with drawing.** The stage fills the teacher's screen with a pen toolbar. What the teacher draws on a
   picture or page appears on the TV at the same place.

Both build on the stage frame the TV already receives (`apps/teacher/src/components/player/stage-content.ts`,
`apps/teacher/src/lib/cast-protocol.ts`), sent over three paths: Google Cast, the laptop screen driven through the
API, and the second window (BroadcastChannel).

## Decisions (from the user, 2026-10-30)

- The TV is hidden only when the teacher presses **Hide on TV**, and shown again only when they press **Show on
  TV**. Changing step, page or word card does not change it.
- While hidden, the TV shows the Little Ants logo.
- Hiding pauses the audio. The teacher may press Play again.
- Wide mode and drawing work without a TV as well (a laptop on the classroom TV over HDMI, or the tablet alone).
- Teacher-only slides (never shown on the TV) are **deferred**: the curriculum has none yet.

## Design

```
LessonPlayer (teacher)
  frame = buildStageFrame(...)            teacher's stage: real frame + ink layer (editable in wide mode)
  hidden ? splashFrame(frame) : frame ──▶ sendToTv / BroadcastChannel ──▶ TV renders logo or stage
  ink[surfaceKey] ───── {type:'ink'} full strokes on change, {type:'ink-live'} points while drawing ──▶ TV ink layer
```

- **Splash leaks nothing.** While hidden the teacher sends a frame with `splash: true` and no material, word or
  character, so the TV never receives the hidden content. Ink is not sent either.
- **Ink is anchored to the content, not the screen.** Points are stored as 0–1 fractions of the box of the picture
  or PDF page being shown (or of a 16:9 board for text and step cards). Tablet, laptop and TV have different screen
  shapes; the stroke still lands on the same spot of the picture.
- **Ink belongs to a surface**: step, view and page (`"3:material:2"`). Turning the page shows that page's ink;
  coming back shows it again. Ink lives in memory for the lesson only.
- **Pure helpers** (quantise, simplify, SVG path, surface key) live in `apps/teacher/src/lib/ink.ts` with no React,
  so the plain Cast receiver for old TVs (Chrome 92) compiles and uses the same code. Ink is drawn as SVG paths.

## Outcome and acceptance

- With a TV or second window connected, a **Hide on TV** button appears. Pressed: within 1 second the TV shows the
  Little Ants logo and its sound pauses. The teacher's stage keeps showing the lesson with a "Hidden on TV" label.
  Moving through steps and pages keeps the TV on the logo. **Show on TV** brings back the current stage.
- After hiding, the TV (all three paths) has not received any material, word or picture of what the teacher moves
  to, checked in tests on the frame that is sent.
- A **Wide** button opens the stage full screen on the teacher's device, with or without a TV. Toolbar: pen in 4
  colours, highlighter, eraser (whole strokes), undo, redo, clear page, back/next, Hide/Show on TV, exit.
- On the tablet, a stroke drawn with a finger or stylus appears on the TV while drawing (Cast and second window
  under 0.2 s, laptop screen under 0.5 s) and lands on the same part of the picture.
- Turning the page clears the view; coming back shows that page's drawing again, on the teacher's screen and on the
  TV. Reconnecting the TV restores the current page's drawing.
- Outside drawing, swiping to turn the page works as before.
- The old Casper TV (Chrome 92) shows the logo and the drawings.

Non-goals: teacher-only slides, shapes (rectangle, circle), laser pointer, saving drawings after the lesson,
GrapeSEED's "Targets", drawing from the TV side.

## Phases

| # | Phase | Depends on | Effort |
|---|-------|-----------|--------|
| 1 | [Hide on TV (splash)](phase-01-hide-on-tv.md) | – | 1d |
| 2 | [Ink model and messages](phase-02-ink-model-messages.md) | – | 0.5d |
| 3 | [Wide mode and drawing on the teacher's device](phase-03-wide-mode-drawing.md) | 2 | 1.5d |
| 4 | [Ink on the TV displays](phase-04-ink-on-tv.md) | 1, 2, 3 | 1d |
| 5 | [Guide, docs and device test](phase-05-guide-docs-device-test.md) | 4 | 0.5d |

## Risks

- **Anchoring.** Pictures use `object-contain` and PDF pages are canvases. The ink layer must cover exactly the
  drawn content box, otherwise strokes drift between devices. Phase 3 wraps media in a box with the media's aspect
  ratio and tests the mapping.
- **Message size.** Cast and the API relay accept 64 000 characters. Strokes are simplified and quantised to 3
  decimals; a surface keeps at most 80 strokes (the oldest go first) so a full ink message stays under the limit.
- **Latency on the laptop screen.** Each live batch is one POST through Cloudflare. Points are batched every 60 ms.
- **Palm on the tablet.** Once a stylus is seen, touch input does not draw.
- **Old receiver.** Chrome 92 supports SVG and Pointer Events; the plain receiver must not use newer syntax (ES2020
  target already).
