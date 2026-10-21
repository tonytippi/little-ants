---
phase: 4
title: "Auth, users and classes"
status: done
priority: P1
effort: "4d"
dependencies: [2]
---

# Phase 4: Auth, users and classes

## Goal

Staff sign in with Google; the API enforces roles; admins manage campuses, classes, teachers and student
records. Student login is not built, but the auth design leaves room for it.

## Design

- **Auth library:** Better Auth in the NestJS API with the Prisma adapter and the Google provider. Its
  `username` plugin can add student username/password login later without changing the session model.
- **Sessions:** HTTP-only, secure cookies on the parent domain (for example `.littleants.vn`) so
  `admin.` and `teacher.` share one session with `api.`. CSRF protection uses SameSite=Lax plus an origin check.
- **Who may sign in:** only emails that an admin has invited. Staff use a mix of personal Gmail and
  Workspace accounts, so there is no domain rule. Unknown Google accounts are refused.
- **Roles:** `ADMIN` (users, everything), `AUTHOR` (edit content and assets), `REVIEWER` (approve content),
  `TEACHER` (own classes, run lessons, record Show & Share). A user can hold several roles.
- **Org model:** Campus → Class (level, current unit, school year, schedule) → Student (display name, birth year,
  status). TeacherAssignment links teachers to classes. The pilot has one campus: keep the Campus table,
  but the UI hides campus pickers while only one exists. Campus-scoped roles are a later change.

## Tasks and steps

1. Add Better Auth tables to the Prisma schema; mount the handler in NestJS.
2. Nest guards: `AuthGuard` (session required) and `RolesGuard` (decorator `@Roles(...)`), plus a class-scope
   check so teachers only see their own classes.
3. Invite flow: an admin adds an email and roles; the first Google sign-in with that email activates the user.
4. CRUD APIs for campuses, classes, students and teacher assignments.
5. Audit log of sign-ins and role changes.
6. Tests: guard unit tests and e2e tests for "teacher cannot read another class".

## Files to create or modify

- `packages/db/prisma/schema.prisma` (auth + org tables)
- `apps/api/src/auth/**`, `apps/api/src/org/**`

## Verification

- An invited Google account signs in; a non-invited account gets a clear "not invited" page.
- E2e tests pass for role and class-scope rules.

## Security

- Children's data: store a display name and birth year only, no photos in this plan. Only staff can
  access it. This follows Vietnam's Decree 13/2023 on personal data; parental consent is collected at
  enrolment (paper or form) before records are created.
- Rate-limit auth endpoints. Keep Google client secrets in VPS env only.
