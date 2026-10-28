# Phase 2: School-scoped staff access and Admin

## Context

`apps/api/src/org/org.controller.ts` (campuses, levels, classes, students; ADMIN-only writes) and
`apps/api/src/auth/staff-access.ts` (`canAccessClass`: ADMIN all, TEACHER by assignment). Admin pages:
`apps/admin/src/app/(app)/classes/*`, `components/classes/class-form.tsx`.

## Requirements

- HQ `ADMIN`: everything, including creating schools and naming school admins.
- `SCHOOL_ADMIN` of school S: campuses, classes, children, parent emails, teacher assignments, enrollment
  operations, all within S.
- `TEACHER` of school S: their assigned classes (Teacher app), and a child's observations only from classes of S.
- Every school route takes `schoolId` and checks membership in one place (`SchoolAccess.require(user, schoolId,
  role)`), like anhhoa's `AuthorizationService.resolve`; 404 for a school the user is not in.

## Steps

1. API: `schools` endpoints (HQ): list/create/rename/deactivate, add/remove school staff by email (reuse staff
   invites: an invite can carry a school + school role).
2. Move org endpoints under `/api/schools/:schoolId/...`; add enrollment operations (start next unit, move, merge,
   stop, leave) and parent emails per child (stored in phase 3's tables; this phase adds the form fields once
   phase 3 lands, or phase 3 adds them).
3. `/api/me` returns the schools and school roles; Teacher app `/teach/classes` filters by SchoolStaff + assignment.
4. Admin: school switcher in the header (HQ sees all), Schools page (HQ), Campuses, Classes (unit history,
   actions with confirmation), Class detail (children with enrollment dates, move/leave), Child detail (parent
   emails, studied units, listening progress later).
5. e2e tests: school admin of A cannot read or change B (404); teacher sees only assigned classes; merge moves the
   active children; HQ admin can do all.

## Validation

API e2e for each role × school; Admin typecheck/lint/build; manual run through Admin after deploy.
