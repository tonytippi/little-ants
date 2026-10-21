---
phase: 5
title: "Admin app"
status: done
priority: P1
effort: "3w"
dependencies: [3, 4]
---

# Phase 5: Admin app

## Goal

A desktop web app where the program team edits curriculum content, manages assets and production,
and manages users and classes. It replaces the Master Sheets and Word lesson plans.

## Screens

1. **Units:** list by level, with a progress bar from production status (replaces tab 0 Dashboard).
2. **Unit editor:** overview fields (tab 1), words (tab 2, grid editing), look back and links (tab 3),
   can-do goals (tab 8), gate checklist (tab 10).
3. **Material editor:** metadata, full text, page-by-page editor for stories and books with an image and
   an audio slot per page, and a preview that uses the same renderer as the Teacher app.
4. **Lesson editor:** header fields, step list (drag to reorder, pick a material, minutes, teacher text,
   children text), prep list, support/challenge/look for/home link. A 40-lesson grid view replaces tab 6.
5. **Asset library:** upload images, audio, video and PDF directly to R2 with presigned URLs; filter by unit,
   material and status; approve; replace by uploading a new version; link to material pages.
6. **Production board:** material × stage grid (tab 9) with filters by owner and status.
7. **History:** revisions per entity with a diff view and "restore as new draft" (replaces tab 11).
8. **Users and classes:** invite staff, assign roles, manage campuses, classes and students.
9. **Validation panel per unit:** live checks from the Content Writing Rules that can be checked by
   machine, such as core word count within the level range, review words at least 25%, story page count
   and words per page within level limits, every lesson step pointing to an existing material, and no
   duplicate sounds in a lesson.
10. **Print view:** lesson plan and unit word list as printable pages (browser print to PDF), since Word
    files are retired.

## API work (NestJS)

- REST modules: units, words, materials, material-pages, lessons, lesson-steps, assets, production,
  revisions, validation.
- Every write goes through the revision helper (phase 2) and checks roles: `AUTHOR` edits drafts,
  `REVIEWER` approves.
- Assets: `POST /assets/upload-url` returns a presigned R2 PUT URL; `POST /assets/:id/complete` checks size
  and checksum. Approved assets get a version-stamped public key; drafts stay private and are read through
  short-lived signed URLs.

## Tasks and steps

1. Build API modules with OpenAPI and generate `packages/api-client`.
2. Build the Admin layout, navigation and auth pages.
3. Build screens 1–10 in this order: Units, Lesson editor, Material editor, Asset library, Production,
   History, Validation, Users and classes, Unit editor details, Print view.
4. Use TanStack Query for data and optimistic edits; autosave drafts.
5. Component tests for editors; API e2e tests for revision and approval flows.

## Verification

- A program lead edits Unit 1 Lesson 12 to fix the duplicate sound, approves it, and sees the change in the
  Teacher app and in History.
- Uploading a new version of an approved poster keeps the old version available and logged.
- The validation panel flags the issues listed in the Unit 1 import report.

## Risks

- Editor scope can grow without end. Build plain forms first; rich layout editing is out of scope
  (layouts stay in Canva; Admin stores the exported images and PDFs).
