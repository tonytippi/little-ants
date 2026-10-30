---
title: Planned TV splash and stage drawing
date: 2026-10-30
summary: Plan for hiding the lesson on the TV behind the logo and drawing on the stage in wide mode
---

# Planned TV splash and stage drawing

## What happened
Planned two GrapeSEED Nexus features for the lesson player: Hide on TV (splash) and a full-screen wide mode with drawing, in plans/261030-1727-tv-splash-and-drawing.

## Decision
Splash is a frame with no content (nothing hidden reaches the TV); toggled only by the teacher; audio pauses. Ink is anchored to the shown picture/page box as 0-1 fractions, kept per step/view/page surface, sent as whole-surface `ink` plus whole-stroke `ink-live` messages over Cast, the API relay and BroadcastChannel. Teacher-only slides deferred (no such content yet).

## Next steps
Implement phases 1-5 with /ak-cook; device test on the Casper TV and an Android tablet.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
