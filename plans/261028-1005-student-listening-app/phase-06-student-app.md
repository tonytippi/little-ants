# Phase 6: Student app (`apps/student`, la-student.passionedu.org)

## Context

Design source: `U05_5_Listening-App/index.html` (CSS tokens, path of leaves, player, Library, My listening,
Teacher tab). Brand v2.1 tokens are already in `packages/ui/src/styles.css`. The Teacher app has the patterns to
reuse: offline media cache and service worker (`apps/teacher/public/sw.js`, `src/lib/media-cache.ts`), outbox
(`src/lib/outbox.ts`), install prompt (`src/lib/install.ts`, `components/install-button.tsx`), storybook pieces
(`components/storybook.tsx`).

## Requirements

- Next.js static app like Teacher, port 3003 (dev) / 9204 (prod), PWA manifest "Little Ants Listening".
- Sign-in screen (Google), device-limit screen (sign out one device), child picker (remembered), unit picker when
  a child has several units (current first).
- Tabs as in the design: Path (hero, Play leaf, 4-leaf week goal, 40 leaves by week: green done, yellow next,
  locked), Library (every known item to replay), My listening (days this week, green leaves, times heard; made to
  be photographed for the teacher), Teacher tab only for staff.
- At home / At school switch: At school only for signed-in staff (shared staff session on `.passionedu.org`);
  all leaves open, choose the lesson's leaf, big-screen player, session plan by level and the do's/don'ts.
- Player: plays the leaf's items in order with pictures/slides and text; songs/chants from recordings; items
  without a recording read by the device voice (Web Speech API, English voice) page by page; word cards say–pause–
  say; the activity cue per item; three stars at the end → leaf green. Large touch targets, works for a child alone.
- Offline: "Download unit" stores the listening payload (IndexedDB) and media (cache); logs queue in an outbox and
  sync later; the 2-new-leaves rule also applied on the device.
- Parent-facing instructions bilingual (English + Vietnamese) as in the guide's Part 6.

## Steps

1. Move shared client pieces to `packages/ui` where both apps use them (install prompt and button, storybook
   pieces, media cache helpers) without changing Teacher behaviour.
2. Scaffold `apps/student` (layout with Baloo 2/Poppins/Andika, providers, service worker, manifest, icons from
   Logo v2.1 app icon).
3. Auth flow screens; API client with CSRF header.
4. Path, Library, My listening; player with recordings + device voice; download + outbox.
5. At school mode for staff.
6. Tests: leaf unlocking rules (pure), outbox, player sequencing (unit); Playwright smoke on the built app with a
   stubbed API.
