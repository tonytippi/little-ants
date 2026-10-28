# Phase 4: Listening plan generator

## Context

Rules: Listening Time Programme Guide, "Rules for the 40 leaves" and "The 40 leaves of every unit"
(`docs/Little Ants English/LA 3-6/00_PROGRAM/05_Listening-Time/LA2_Listening-Time-Guide.html`). Worked example:
the U05 prototype data (`D.spots`, `D.est`, `D.wcsets` in `U05_5_Listening-App/index.html`) and its generator
`U05_3_HTML/_build/listening/app_data.py`. Release payload: `packages/shared/src/release.ts`, built by
`apps/api/src/releases/release-builder.service.ts`.

## Rules to implement (pure function, `packages/shared/src/listening-plan.ts`)

Input: release payload (lessons with steps → first lesson each material is taught; materials with type, audio
duration if known; word cards grouped), level (home minutes), the bridge song from the previous unit (code, title,
audio) if any. Output: 40 leaves `{ number, stage, items: ListeningItem[], minutes }`.

- A leaf only plays materials first taught on or before its lesson number.
- Leaves 1–5 start with the bridge song; 6–8 with one favourite from the last unit.
- 1–8 "Look back & meet"; 9–36 "Listen & join in": word-card set, two songs/chants, sound + its rhyme, a story,
  a book every second leaf, a Move & Do, the Talk Scene every third leaf.
- New materials get priority in the 1–2 leaves after they are taught; otherwise pick the least-heard item of each
  kind (count lesson uses + earlier leaves).
- Total audio within the level's home minutes (Level 1: 6–9, Level 2: ~10, Level 3: 10–15); durations from audio
  metadata or estimates per kind (prototype `D.est`).
- 37–38 party (all songs/chants + Move & Do); 39–40 favourites (rhymes + sounds + books; then stories).
- Word-card sets: groups of 6 by word group in order.

## Steps

1. Types `ListeningLeaf`, `ListeningItem` (material code | word set | bridge) in shared; `RELEASE_FORMAT` bump,
   `payload.listening?: { leaves, bridge }` (optional for old releases).
2. Generator + tests on the U05 payload fixture: every rule above as an assertion (not equality with the prototype,
   which was tuned by hand); deterministic output.
3. Release builder: look up the previous unit's latest release for the bridge song; attach the plan.
4. Admin unit page: read-only "Listening Time" tab showing the 40 leaves (helps the content team check it).
