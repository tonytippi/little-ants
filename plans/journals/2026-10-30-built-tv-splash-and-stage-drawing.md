---
title: Built TV splash and stage drawing
date: 2026-10-30
summary: "Hide on TV and wide-mode drawing implemented; review fixes for relay ordering, palm, page changes"
---

# Built TV splash and stage drawing

## What happened
Implemented Hide on TV (splash frame with no lesson content, audio pauses) and Wide mode drawing (ink anchored to the shown picture/PDF page box, per-page undo/redo, `ink` / `ink-live` messages over Cast, the laptop relay and the second window). Headless Chrome checks confirmed anchoring across three aspect ratios, eraser, splash, and the static Cast receiver drawing ink.

## Problems found
- stage-content.ts gained an extensionless runtime import; the TV loads compiled files as plain ES modules, so the receiver would not have started. Fixed by passing the surface key in, plus a test that every runtime import in receiver modules ends in `.js`.
- Review: laptop relay POSTs could overtake each other (a Hide overtaken by a frame); now sent one at a time with newest-wins for strokes in progress. Also fixed palm-before-pen, strokes continuing onto the next page, ink over the old PDF page while the new one draws, very long strokes wiping a page, mid-stroke exit, fullscreen race, key repeat.

## Decisions kept
While hidden, audio `load` still goes to the TV (needed for reconnect resync); `hidden` stays on after a TV disconnects (only the teacher shows it again).

## Next steps
Commit, deploy after approval, device test on the Casper TV and an Android tablet (phase 5).

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
