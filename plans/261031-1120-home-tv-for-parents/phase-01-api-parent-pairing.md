---
phase: 1
title: "API and protocol: parent pairing"
status: completed
priority: P1
effort: "0.75d"
dependencies: []
---

# Phase 1: API and protocol: parent pairing

## Goal

A signed-in parent can pair a screen and relay listening messages to it; staff pairing is unchanged.

## Files

- Modify: `packages/shared/src/screens.ts` — `PARENT_TO_SCREEN_TYPES = ['listen', 'audio', 'end']`; add `'listen'`
  to the display's accepted types; `ListenFrame` type (picture, title, kindLabel, act, lines, current, big, small,
  colour, cover); `screenPairUrl(baseUrl, code)` → `${base}/tv/pair?code=…`; `screenCodeFromScan` accepts
  `/tv/pair` as well as `/screen/pair`.
- Modify: `apps/api/src/screens/screens.service.ts` — controller identity `{ kind: 'staff' | 'parent', id, name }`
  instead of the teacher's user id; `paired` event carries `{ controllerName, kind }`.
- Modify: `apps/api/src/screens/screens.controller.ts` — parent routes under the same controller with
  `ParentGuard` (`POST /screens/parent/pair`, `GET /screens/:id/parent-events`, `POST /screens/:id/parent-messages`,
  `DELETE /screens/:id/parent`), body validated with the parent message types.
- Modify: `apps/api/src/screens/screens.module.ts` — import what `ParentGuard` needs.
- Tests: `apps/api/test/screens*.test.ts` — parent pairs, relays `listen`, cannot send `frame`/`ink`; a parent
  cannot take a screen paired by staff or another parent; staff tests unchanged.

## Steps

1. Shared types and helpers (no runtime change for staff).
2. Service: generalise the controller; keep limits (1,000 screens, idle 12 h, code lifetime).
3. Controller routes for parents; `@Public()` + `ParentGuard`, like the parent listening routes.
4. Tests.

## Verification

- `pnpm --filter @little-ants/api test typecheck lint`; shared tests for `screenCodeFromScan` and `screenPairUrl`.
