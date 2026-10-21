---
phase: 2
title: "Content data model"
status: done
priority: P1
effort: "5d"
dependencies: [1]
---

# Phase 2: Content data model

## Goal

A Prisma schema that holds everything the Master Sheets and lesson plans hold today, with versioning
and a change log, so Admin can replace Excel and Word.

## Source structure (from the docs)

Each unit's `UNN_MASTER-SHEET.xlsx` has these tabs: 0 Dashboard, 1 Overview, 2 Words, 3 Look Back & Links,
4 Materials Plan, 5 Content Texts, 6 Class Overview, 7 Lesson Prep, 8 Show & Share, 9 Production,
10 Gate Checklist, 11 Change Log. Each unit also has `UNN_Lesson-Plans_L01-40.docx`, with a fixed shape per
lesson: header (week, stage, minutes, NEW today), can-do goals, key language, prepare list, a flow table
(time, what the teacher does and says, what children do), support and challenge, look for, home link.
`UNN_Content-Texts.docx` holds page-by-page text for stories and books ("Page 1: …").

## Model (entities and key fields)

- **Program** (`LA` 3–6; `TA` 0–3 reserved for later) → **Level** (1 Little Ants, 2 Busy Ants, 3 Big Ants;
  age band, lesson minutes, class size, level rules).
- **Unit**: code `U01`, number, title, lead character, Big Question, value, VN kindergarten link, party,
  sounds, bridge song, look-back lessons.
- **Character**: code, name, art asset (14 characters + Pip butterfly).
- **Word**: card ID `U01-01`, text, type, core/extra/review, group, source unit, picture brief, asset.
- **Material**: unit, code (`SG1`, `CH1`, `RH1`, `ST1`, `BB1`, `MD1`, `TS1`, `SN`, `TT`, `HH`, routine `RT1`…),
  type enum, title, tune/format, target language, actions, teacher notes, first taught lesson.
- **MaterialPage**: material, page number, text, image asset, audio asset (stories, books, Talk Scene, cards).
- **Lesson**: unit, number 1–40, week, stage (Hear it / Join in / Say it myself / Party / Show & Share),
  minutes, new-today materials, can-do goals, key language, support, challenge, look for, home link,
  prep minutes.
- **LessonStep**: lesson, order, minutes, step kind (Hello Circle, Song, Sound Trail, Rhyme, Ant Wiggle,
  Story, Book, Move & Do, Extra, Checkpoint, Goodbye), material reference (optional), teacher text,
  children text.
- **PrepItem**: lesson, text, material reference (optional).
- **CanDoGoal**: unit, order, text (Show & Share columns).
- **Asset**: kind (image, audio, video, pdf), R2 key, mime, size, checksum, status (draft, review, approved,
  archived), version, source (upload, AI later), created by. Approved assets are immutable; a change
  creates a new version.
- **ProductionStatus**: material × stage (text, English check, illustration, layout, audio/video, teacher test,
  print-ready) with status (Not started, In progress, Review, Done, N/A), owner, due date.
- **GateCheck**: unit, gate 1–5, check text, done, signed by, date.
- **Revision**: entity type, entity id, version, JSON snapshot, author, timestamp, note. Written for every
  edit of a content entity. It replaces the Change Log tab.

Content entities carry `status` (draft, review, approved) and `version`. Editing an approved entity creates a
new draft revision; publishing it moves it to approved. This follows the docs rule "never overwrite an
approved file".

## Tasks and steps

1. Write `packages/db/prisma/schema.prisma` with the entities above, unique keys (`unit.code`,
   `[unitId, code]` for materials, `[unitId, number]` for lessons, `word.cardId`).
2. Add a Prisma client extension or service-layer helper that writes a `Revision` row in the same
   transaction as each content update.
3. Seed programs, levels and characters from the Program Plan.
4. Add zod schemas for each entity in `packages/shared` so the API, importer and apps validate the same way.
5. Unit tests for the revision helper and the approved-is-immutable rule.

## Files to create

- `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/**`, `packages/db/src/seed.ts`
- `packages/db/src/revision.ts`, `packages/shared/src/content/*.ts`

## Verification

- `pnpm --filter db prisma migrate dev` runs clean on an empty database.
- Tests prove that updating an approved material creates a new draft revision and leaves the approved one intact.

## Risks

- Over-modelling. Keep free-text fields where the docs are free text (teacher notes, support/challenge)
  instead of inventing sub-structures.
- Tiny Ants uses "Nest" and "Session" instead of "Unit" and "Lesson". Keep the generic names in the schema
  and map labels per program in the UI later.
