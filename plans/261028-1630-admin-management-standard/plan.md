# Admin management pages: one standard

Status: done

## Outcome
Every management page in Admin works the same way: a table list, a primary "+ Add" button, a row actions
menu, add/edit in a modal (class detail stays a page), and confirmations in a modal instead of
`window.confirm`. A new Students page lists the school's children.

## Constraints
- Keep existing API contracts; add only `GET /schools/:schoolId/students`.
- Same access rules as today (school admin / HQ admin). Children responsible to the school = latest
  enrollment there (same rule as the Parents page).
- Brand look and shared UI package stay; no new dependencies.

## Non-goals
Content pages (Units, Assets, Drive sync, unit/material/lesson editors) keep their current layouts.

## Pieces
1. Shared: `FormDialog`, `RowMenu` (⋯ actions), `DataTable`, unique dialog title ids.
2. API: school students list + e2e test.
3. Pages: Schools, Campuses (new, from the Classes page card), Classes (+ New class modal), Students (new),
   Parents, School staff, HQ staff; class detail children use the student modals.
4. Menu: Campuses and Students under Schools.

## Acceptance
- No inline add/edit forms or `window.confirm` left on those pages.
- Typecheck, lint, API tests and builds pass; checked in a browser at desktop and phone widths.
