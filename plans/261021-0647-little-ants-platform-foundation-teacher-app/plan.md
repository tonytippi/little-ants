---
title: "Little Ants platform: foundation, Admin and Teacher app"
description: "Move the Little Ants 3–6 curriculum from Excel/Word into a database edited in Admin, and give teachers an offline-capable lesson player for the Level 1 pilot."
status: in-progress
priority: P1
effort: 8-10w
tags: [feature, infra, backend, frontend, database, auth]
blockedBy: []
blocks: []
created: 2026-10-21
---

# Little Ants platform: foundation, Admin and Teacher app

## Overview

Little Ants English (ages 3–6, 12 units × 40 lessons) currently lives in Excel Master Sheets
and Word lesson plans under `docs/Little Ants English/LA 3-6/`. This plan builds the first two
products of the platform:

- **Admin** becomes the single source of truth for curriculum content, assets, production status
  and users. Excel and Word are retired after import and sign-off.
- **Teacher app** lets a teacher run each lesson in class on a laptop + TV/projector or on a tablet,
  works offline, and records Show & Share observations.

The Student app (Home Hill at home), the Tiny Ants 0–3 program, and AI features are later plans.
The timeline follows the curriculum roadmap: Level 1 (Units 1–4) is piloted Nov 2026 – Jan 2027.

## Outcome and acceptance criteria

- All 12 LA 3-6 units are imported; an import report lists every data problem found.
- A program lead can edit a text, word, lesson step or asset in Admin; every change is versioned and
  logged; approved items are never overwritten.
- A teacher signs in with Google, picks a class, opens any Level 1 lesson and runs it end to end
  with posters, story pages and audio — including with the network turned off after download.
- A teacher records Show & Share results (Not yet / With help / On my own) per child; results sync
  when the device comes back online.
- The stack runs on one VPS with `docker compose`, behind Cloudflare Tunnel; media comes from R2 via a
  custom domain, and the database is backed up daily to R2.

## Constraints

- TypeScript everywhere: Next.js (Admin, Teacher), NestJS (API), Prisma + PostgreSQL.
- PWA only; native apps later.
- Staff sign in with Google only. Student login is not part of this plan, but the auth design must
  allow username/password for students later.
- Children's personal data is minimal (display name, class, birth year) and staff-only.

## Non-goals

- Student app, parent accounts, student login.
- Tiny Ants 0–3 content import.
- AI text/image generation in Admin.
- Tablet-as-remote-control for the TV (one device runs the lesson in this plan).
- School package, billing, multi-tenant schools.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Monorepo and infrastructure foundation](./phase-01-monorepo-foundation.md) | Pending |
| 2 | [Content data model](./phase-02-content-data-model.md) | Pending |
| 3 | [Master Sheet importer](./phase-03-master-sheet-importer.md) | Pending |
| 4 | [Auth, users and classes](./phase-04-auth-users-classes.md) | Pending |
| 5 | [Admin app](./phase-05-admin-app.md) | Pending |
| 6 | [Teacher app](./phase-06-teacher-app.md) | Pending |
| 7 | [Deploy and pilot](./phase-07-deploy-and-pilot.md) | Pending |

Order: 1 → 2 → (3 and 4 in parallel) → (5 and 6 in parallel) → 7.

## Decisions (validated with the user, 2026-10-21)

- Students are ages 3–6 only. Classes are taught on both laptop + TV/projector and tablets.
- Admin fully replaces the Excel Master Sheets and Word lesson plans after import.
- Stack: TypeScript, Next.js, NestJS, Prisma.
- Staff login is invite-only by email (mix of Gmail and Workspace accounts).
- Keep a Campus model, with one campus at first.
- Presenter mode (TV shows the material, laptop shows notes and timer) is in the pilot.
- Lesson plans must be printable from Admin and the Teacher app.

## Implementation notes (2026-10-21)

Changes from the original phase text, decided during implementation:

- **Unit releases.** The Teacher app reads immutable `UnitRelease` bundles built when a reviewer publishes a unit. Admin edits the working rows; editing approved content reopens it as a new draft version. Publishing is blocked until every item is approved and the content rules report no errors.
- **Storage package.** `packages/storage` has an R2/S3 driver and a local-folder driver (signed URLs served by the API) because Docker was unavailable on the development machine.
- **Content rules shared.** `packages/shared/src/content-rules.ts` powers both the importer report and the Admin validation tab.
- **Auth without a Nest wrapper.** Better Auth is mounted directly on Express before the JSON body parser. Development email + password sign-in exists behind `AUTH_DEV_PASSWORD_LOGIN` and is refused in production.
- **Service worker by hand.** Serwist does not support Turbopack builds in Next 16, so `apps/teacher/public/sw.js` is hand-written and versioned by `BUILD_ID`.
- **Draft preview.** Admin previews lessons through the Teacher player using `GET /api/content/units/:code/preview`.

Phase 7 status: Docker images, compose stack, tunnel, R2 backups and the runbook ([docs/operations/deploy-and-restore.md](../../docs/operations/deploy-and-restore.md)) are done. The first VPS deploy, production import and the classroom pilot are still to do; they need the Cloudflare, Google and VPS accounts.

## Dependencies

- Cloudflare account with the domain, an R2 bucket and a Tunnel token.
- A Google Cloud OAuth client (web) for staff login.
- A VPS with Docker (2 vCPU / 4 GB RAM is enough for the pilot).
- Final audio for Level 1 is produced by the content team; the Teacher app works with drafts until then.
