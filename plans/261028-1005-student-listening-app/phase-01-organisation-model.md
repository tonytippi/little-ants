# Phase 1: Organisation model and migration

## Context

Today: `Campus` (global, unique name) → `Class` (campusId, levelId, currentUnitId, nextLesson, schoolYear) →
`Student` (classId, displayName, birthYear, status, consentAt). `TeacherAssignment` links staff to classes.
`LessonRun` and `Observation` reference `classId` (and `studentId`). All data is test data: clean break allowed.

## Target schema (packages/db/prisma/schema.prisma)

- `School`: id, name (unique), active, createdAt.
- `Campus`: + `schoolId`; name unique per school (`@@unique([schoolId, name])`).
- `Class`: keeps campusId, levelId, name, schoolYear, lessonDays, nextLesson; `currentUnitId` stays as the fast
  "now" pointer, kept in sync with the open run. + `status` enum `ClassStatus` (ACTIVE, MERGED, STOPPED),
  `endedAt`, `mergedIntoId` (self relation). Drop `active` (status replaces it).
- `ClassUnitRun`: classId, unitId, startedOn (date), endedOn (date, null = current). One open run per class
  (partial unique index in SQL migration). A class's unit history.
- `Student`: global. Remove `classId` and `status`. Keep displayName, birthYear, consentAt.
- `Enrollment`: studentId, classId, startedOn, endedOn (null = active), endReason enum (LEFT, MOVED, MERGED,
  CLASS_STOPPED, GRADUATED). At most one active enrollment per child (partial unique index).
- `SchoolStaff`: userId, schoolId, role enum `SchoolRole` (SCHOOL_ADMIN, TEACHER). `@@unique([userId, schoolId])`.
  Global `Role` keeps ADMIN, AUTHOR, REVIEWER for HQ. `TEACHER` is removed from `Role`: being a teacher is a
  `SchoolStaff` row, so there is one source of truth. HQ admins can still open the Teacher app (preview).
- `Observation` and `LessonRun` unchanged (still class-scoped).

## Derived rules (packages/shared or api service, unit-tested)

- Child is active ⇔ has an enrollment with `endedOn = null` in an ACTIVE class.
- Studied units of a child = units of every `ClassUnitRun` that overlaps one of the child's enrollments
  (overlap on dates), plus the current run of the active class.
- Operations (single transaction each):
  - start next unit: close the open run (endedOn = today), open a run for the new unit, set `currentUnitId`,
    `nextLesson = 1`.
  - move child: end the active enrollment (MOVED), create one in the target class.
  - merge class A into B: end A's active enrollments (MERGED) and create them in B; A → MERGED, close its run.
  - stop class: end active enrollments (CLASS_STOPPED), close the run, status STOPPED.
  - child leaves: end the enrollment (LEFT).

## Steps

1. `pnpm --filter @little-ants/db backup before-schools`.
2. Edit the schema; create migration `schools_campuses_enrollments` (drops/recreates org tables; add the two partial
   unique indexes in SQL).
3. `OrgService` (apps/api/src/org/org.service.ts) with the operations and the derived rules.
4. Update compile errors across api/admin/teacher that used `Student.classId`, `Class.active`, `campus` uniqueness.
5. Tests: db-level tests for the partial indexes; service tests for each operation and for studied units (child in
   U05 at school A, then U06 at school B → studied {U05, U06}; leaving → inactive).

## Validation

`pnpm turbo lint typecheck test` green; migration applies on a copy of the production database
(restore into `restore_check`, run `migrate deploy`).
