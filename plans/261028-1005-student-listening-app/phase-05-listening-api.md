# Phase 5: Listening API and progress sync

## Context

Teacher app reads `/api/teach/units/:code/release` (full payload incl. lesson plans) and syncs offline records via
`/api/teach/sync` with client ids (`apps/api/src/teach/teach.controller.ts`). Parents must get only what listening
needs.

## Schema

- `ListeningLog`: clientId (unique), studentId, unitCode, leaf, mode (HOME, SCHOOL), playedOn (local date),
  completedAt, itemsHeard (string[]), parentSessionId or staff userId, createdAt. Index (studentId, unitCode).

## Endpoints

- Parent (`/api/parent/students/:id/...`, phase 3 guard):
  - `units`: studied + current units with picture and release version.
  - `units/:code/listening`: listening payload = unit info, leaves, the materials/words/media they use, page texts
    (for device voice), no lesson plans or teacher notes. Only for units the child may open.
  - `listening/sync` (POST, CSRF): batch of logs, idempotent by clientId, each accepted/rejected on its own.
  - `listening/summary`: green leaves, days per week, times each item heard.
- Rules enforced on the server: at most 2 new leaves per local day at home (reject, keep the client honest); a
  leaf counts green when completed.
- Staff At school (`/api/teach/classes/:id/listening/...`): listening payload of the class's current unit; logs
  with mode SCHOOL for the class (no per-child record).

## Steps

1. Schema + migration (backup).
2. `listening` module: payload projection from the release (pure function, unit-tested), endpoints, sync.
3. e2e: parent of child A cannot read child B; left child → 403; unit not studied → 404; sync idempotent; third new
   leaf in a day rejected.
