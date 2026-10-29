---
phase: 2
title: "Screen relay in the API"
status: completed
priority: P1
effort: "1.5d"
dependencies: []
---

# Phase 2: Screen relay in the API

## Goal

The API pairs a laptop screen with one signed-in teacher and relays messages both ways in real time.

## Files

- Create: `apps/api/src/screens/screens.module.ts`, `screens.service.ts`, `screens.controller.ts`
- Create: `apps/api/test/screens.service.test.ts` (or the API's existing test location)
- Modify: `apps/api/src/app.module.ts` — import `ScreensModule`.
- Create: `packages/shared/src/screens.ts` — request/response types and the pairing code alphabet, exported from the
  package index.

## Endpoints

| Method and path | Who | Purpose |
|---|---|---|
| `POST /screens` | public | New screen: `{ screenId, displayToken, code, expiresAt }` |
| `GET /screens/:id/display-events?token=` | public + display token | SSE to the laptop: `paired { teacherName }`, relayed teacher messages, `unpaired` |
| `POST /screens/:id/display-messages?token=` | public + display token | Laptop → teacher (`ready`, `audio-status`) |
| `POST /screens/pair` `{ code }` | signed-in staff | Claim a screen by its code: `{ screenId }` |
| `GET /screens/:id/events` | the pairing teacher | SSE to the tablet: relayed laptop messages, `screen-online` / `screen-offline` |
| `POST /screens/:id/messages` | the pairing teacher | Tablet → laptop (`frame`, `audio`, `end`) |
| `DELETE /screens/:id` | the pairing teacher | Disconnect; the laptop gets `unpaired` and a new code |

## Rules

- Ids and display tokens: 128-bit random, compared in constant time. Codes: 6 characters from an alphabet without
  look-alikes (no 0/O, 1/I/L), single use, valid 15 minutes.
- A screen without a connected laptop for 2 minutes is removed. A paired screen with no messages for 12 hours is
  removed. At most 1,000 screens; `POST /screens` returns 429 above that.
- Messages are relayed without reading them: the API checks that `type` is one of the known ones and that the JSON
  body is at most 64 KB.
- SSE with Nest `@Sse()` (RxJS subjects per screen), a comment heartbeat every 20 seconds, and
  `X-Accel-Buffering: no`. EventSource from `la-teacher` uses `withCredentials` for the teacher stream; CORS already
  allows that origin with credentials.
- Pairing again by the same teacher (another lesson, a reload) keeps the screen; another teacher gets 409 until the
  first disconnects or the screen expires.

## Verification

- Unit tests for the service: code single use and expiry, wrong code, wrong display token, owner check, other teacher
  409, cap 429, removal after the laptop leaves.
- `pnpm --filter @little-ants/api typecheck lint test`.
- `curl -N` against a local API: open a display stream, pair with a signed-in cookie, post a frame, see it arrive.
