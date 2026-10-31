---
phase: 2
title: "TV entry"
status: pending
priority: P2
effort: "0.25d"
dependencies: [1]
---

# Phase 2: TV entry

## Goal

Someone on a TV browser types `littleantsenglish.com`, presses **Watch on TV**, and sees the classroom pairing
code.

## Files

- Create: `apps/student/src/app/tv/route.ts` — redirects to `${NEXT_PUBLIC_TEACHER_APP_URL}/screen`.
- Modify: `apps/teacher/src/components/player/tv-menu.tsx`, `qr-scanner.tsx`, `apps/teacher/src/app/tv-help/page.tsx`
  — tell teachers to open `littleantsenglish.com` → Watch on TV (shorter to type on a TV remote).

## Steps

1. `/tv` redirect (302, so the target can change when the home TV mode arrives). Done with phase 1.
2. Update the teacher guidance text.

## Verification

- Old TV browser profile (Chrome 92 user agent in Playwright): landing → Watch on TV → pairing code visible,
  no scrollbars.
- Teacher tests and lint.
