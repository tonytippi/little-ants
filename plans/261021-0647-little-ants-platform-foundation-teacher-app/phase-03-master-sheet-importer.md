---
phase: 3
title: "Master Sheet importer"
status: done
priority: P1
effort: "5d"
dependencies: [2]
---

# Phase 3: Master Sheet importer

## Goal

A repeatable CLI that reads the 12 LA 3-6 Master Sheets, lesson plan Word files and content text Word
files, writes them into the database, uploads existing draft designs to storage, and produces a data
quality report. After sign-off, the Excel and Word files are archived and Admin is the source of truth.

## Key insights

- Tab layouts are the same across all 12 units (they come from `TEMPLATE_UNN_Master-Plan.xlsx`), so one parser fits all.
- Lesson plan files follow a fixed text shape per lesson ("Lesson 12", "Week 3 · Join in · 30 minutes · NEW today: BB2",
  section headings in capitals, a three-column flow table).
- The draft data already has errors that the importer should flag, not hide. Example: Unit 1 Lesson 12
  shows "Sound Trail: m /m/ + m /m/" (the same sound twice).
- Folder and file names are inconsistent (`03_Content_` vs `03_Content`, `DRAFT (1)`, `~$` lock files,
  `.DS_Store`). Discover files by pattern, not by fixed path.

## Tasks and steps

1. `tools/importer` CLI: `import --unit U01 [--dry-run]` and `import --all`.
2. Parse xlsx with `exceljs`, tab by tab, by header name rather than column index.
3. Parse docx with `mammoth` (to HTML) and split by "Lesson N" headings; map flow table rows to `LessonStep`.
4. Parse content text docx: per material code, "Page N:" lines into `MaterialPage`.
5. Match lesson steps to materials by code (`SG1`, `ST2`…) found in the step title.
6. Upsert by natural keys so re-running the import does not create duplicates. Write a `Revision` with the note "import".
7. Upload `04_Design/DRAFT` PDFs and the `01_BRAND/Characters/FINAL` PNGs as `draft` assets and link them by code
   in the file name (`U01_ST1_…`).
8. Write `plans/reports/import-<unit>.md` with counts and warnings: duplicate sounds, missing materials referenced
   by lessons, lessons that do not have 40 rows, words with no picture brief, and mismatches between
   tab 6 (Class Overview) and the Word lesson plans.
9. Back up the database before every non-dry-run import (`pg_dump` to `infra/backup/`).

## Files to create

- `tools/importer/src/{cli,xlsx-master-sheet,docx-lesson-plans,docx-content-texts,assets,report}.ts`
- `tools/importer/test/fixtures/` (small copies of real tabs and lessons)

## Verification

- Dry run on all 12 units completes with no crash and a report per unit.
- Unit 1 counts: 40 lessons, 40 core words, and the materials listed in tab 4 (SG1–SG3, CH1–CH2, RH1–RH3,
  ST1–ST3, BB1–BB2, MD1–MD3, TS1, SN, TT, HH, RT1–RT3).
- Running the import twice gives the same row counts.
- A program lead reviews the Unit 1 report and the data in Admin, and signs off before Excel is archived.

## Risks

- Word files may differ slightly between units. Mitigation: parser tests use fixtures from 3 different units;
  unparsed blocks go into the report instead of being dropped.
- Excel could keep being edited during migration. Mitigation: freeze Excel edits from the import sign-off date.
