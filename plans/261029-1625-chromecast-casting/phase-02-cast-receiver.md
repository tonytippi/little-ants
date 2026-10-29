---
phase: 2
title: "Cast receiver page"
status: in-progress
priority: P2
effort: "1d"
dependencies: [1]
---

# Phase 2: Cast receiver page

## Goal

A public page at `https://la-teacher.passionedu.org/cast-receiver` that runs on the TV as the Cast Web Receiver of app
`B1587FA6` and renders stage frames sent by the teacher.

## Files

- Create: `apps/teacher/src/app/cast-receiver/page.tsx` — receiver screen.
- Create: `apps/teacher/src/lib/cast-protocol.ts` — namespace, message types and guards shared by sender and receiver.
- Modify: `apps/teacher/src/app/providers.tsx` — on `/cast-receiver`, do not start the outbox or register the service
  worker (the TV has no session and no offline use).

## Steps

1. Protocol in `cast-protocol.ts`:
   - Namespace `urn:x-cast:org.passionedu.littleants`, JSON messages.
   - Sender → TV: `{ type: 'frame'; frame: StageFrame }`, `{ type: 'end' }`. Phase 4 adds audio messages.
   - TV → sender: `{ type: 'ready' }` on start and whenever a sender connects, so the sender resends the current
     frame.
   - `isCastMessage()` guard, like `isPresenterMessage()`.
2. Receiver page:
   - Load `https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js` with `next/script`
     (`beforeInteractive` is not allowed on a page; use `afterInteractive` and wait for `window.cast`).
   - `CastReceiverContext.getInstance()`: register the custom namespace as JSON, listen for messages, then
     `start({ disableIdleTimeout: true, customNamespaces: {...} })` so the TV does not close during a lesson.
   - On `SENDER_CONNECTED`, send `ready` to that sender.
   - Render with `<Stage presenter frame={frame} />` full screen. Before the first frame: Little Ants logo and
     "Waiting for the teacher…". On `end` or when the last sender disconnects: back to the waiting screen.
   - No `RequireStaff`, no API calls. Only render what the message contains.
3. Keep the page a static route. Do not add it to the service worker's offline routes.

## Security

The page is public and has no data of its own. It only renders frames from senders connected through Cast to this
app ID on the same network. Frames hold public media URLs (approved assets) or short-lived signed URLs (preview).

## Verification

- `pnpm --filter @little-ants/teacher typecheck`, `lint`, `test`.
- Deploy to production (only registered TVs can launch an unpublished receiver).
- On the registered Android TV, launch app `B1587FA6` with Google's Cast Command and Control (CaC) tool, send a frame
  for a story page, a PDF page and a word card by hand. Inspect with `chrome://inspect` from a computer on the same
  network.
- Measure the time to the first PDF page on the TV. If it is over 3 seconds, note it for phase 3's device gate.
