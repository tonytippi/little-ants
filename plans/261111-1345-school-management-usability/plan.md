# School management: easier tables, filters and modals

Status: done (browser check pending)

## Outcome
Schools, Campuses, Classes and Teachers are managed from one "Schools" menu group. Every page is a table
with filters above it (the school is one of them, instead of a hidden switcher in the sidebar), and every
change happens in a modal opened from the row's ⋯ menu, also on the class page.

## Constraints
- Same access rules (HQ admin / school admin). Existing API contracts stay; one endpoint is added:
  `PUT /schools/:schoolId/staff/:userId/classes` sets the active classes a teacher teaches at the school.
- No new dependencies; shared UI package and brand look stay.

## Non-goals
Content pages, Students/Parents page layouts (they only get the school filter), HQ staff page content.

## Pieces
1. Menu: Schools group = Schools, Campuses, Classes, Teachers, Students, Parents; HQ staff in an HQ group.
   `/school-staff` becomes `/teachers` (old path redirects). Sidebar school switcher replaced by a school
   filter in each school page's toolbar.
2. Schools: search + status filter; row menu opens its campuses, classes, teachers.
3. Campuses: search + status filter, active class count linking to the filtered class list.
4. Classes: search, campus, level, teacher (incl. "no teacher") and status filters (from the URL too);
   row menu: open, edit, teachers, merge, stop — all modals. Class page uses the same modals.
5. Teachers: search, role, class filters; row menu: change role, assign classes (new endpoint), remove.

## Acceptance
- No inline edit forms left on school/campus/class/teacher pages; class page edits via modals.
- Typecheck, lint, API tests and admin build pass.
