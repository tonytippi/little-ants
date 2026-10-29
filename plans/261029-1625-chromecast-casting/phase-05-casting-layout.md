---
phase: 5
title: "Teaching layout while casting"
status: in-progress
priority: P2
effort: "1d"
dependencies: [3]
---

# Phase 5: Teaching layout while casting

## Goal

When a TV is connected (Chromecast or Second window), the teaching screen puts the teacher's notes first, like
GrapeSEED Nexus: notes always visible and larger, the stage as a preview of what the TV shows. Without a TV, the
current layout stays.

## Context

- Today notes open by default only at `window.innerWidth >= 1024`; below that they are an overlay that covers the
  stage (`lesson-player.tsx`). Many Android tablets in landscape are 960–1340 CSS px wide and about 600–800 px high.
- The header wraps on tablets and takes vertical space.

## Layout while connected

```
┌ ← U05  Lesson 3 · My Home        ⏱ 12:04/45:00   Step 01:20   [On TV: Phòng 2 ■] ┐
├──────────────────────────────┬───────────────────────────────────────────────────┤
│  Stage preview (≈40%)        │  Step 4 · Song: Where is my cat?          A− A+   │
│  [what the TV shows]         │  YOU DO AND SAY                                   │
│                              │  Point to the picture and sing twice…             │
│  ◀  Page 2 / 6  ▶            │  CHILDREN                                         │
│  [▶ audio on TV  0:42/1:30]  │  Sing and do the actions…                         │
│  [Word cards]                │  TIPS / KEY LANGUAGE / LOOK FOR …                 │
├──────────────────────────────┴───────────────────────────────────────────────────┤
│  step rail                                                                        │
└───────────────────────────────────────────────────────────────────────────────────┘
```

Portrait tablet: stage preview on top (about 35% of the height), notes below.

## Files

- Modify: `apps/teacher/src/components/player/lesson-player.tsx` — a `tvConnected` layout branch.
- Modify: `apps/teacher/src/components/player/notes-panel.tsx` — text size from a prop.
- Create: `apps/teacher/src/lib/note-size.ts` — read and write the chosen size in `localStorage` (small, medium, large,
  extra large).

## Steps

1. When `tvConnected` becomes true, show notes inline (never as an overlay) at about 60% width in landscape; the
   Notes toggle is hidden while connected. When it becomes false, restore the previous layout and notes state.
2. Stage preview keeps swipe and the ◀ ▶ buttons; the audio bar and Word cards sit under it.
3. Note size control `A− A+` in the notes header, 4 steps, remembered per device.
4. Compact header while connected: the TV status replaces the Show on TV button label.

## Verification

- `pnpm --filter @little-ants/teacher typecheck`, `lint`, `test` (note size storage helper).
- Chrome device emulation at 1280×800, 1024×600 and 800×1280: notes readable without scrolling the page, stage preview
  and controls visible, no overlay while connected.
- On the Android tablet while casting: teach one full lesson.
