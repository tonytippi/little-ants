---
title: "littleantsenglish.com: landing page, Student app at the root, TV entry"
description: "Move the apps to littleantsenglish.com. The root shows a bilingual landing page (VI default, EN at /en) with Sign in and Watch on TV; the Student app moves to /app."
status: in-progress
priority: P1
effort: 3d
branch: feat/littleantsenglish-domain
tags: [feature, frontend, infra]
blockedBy: []
blocks: []
created: 2026-10-31
---

# littleantsenglish.com: landing page, Student app at the root, TV entry

## Decisions (from the user, 2026-10-31)

- The user bought `littleantsenglish.com` and pointed it at Cloudflare.
- The Student app lives on the root domain, behind a landing page with **Sign in** (parents) and **Watch on TV**.
- No teacher link on the landing page.
- Landing page: one language at a time with a VI | EN switch; Vietnamese is the default. The apps keep their
  current English + short Vietnamese lines.
- Copy is drafted from the program plan and brand guide; pictures are the program's AI pictures. Draft:
  [landing-copy.md](landing-copy.md).
- Deferred: parents showing a leaf on the home TV (TV pairs with the parent's phone).

## Addresses

| Address | What |
|---|---|
| `littleantsenglish.com/` · `/en` | Landing page (VI · EN) |
| `littleantsenglish.com/app` | Student app (At home / At school); the installed app opens here |
| `littleantsenglish.com/signin` | Parent sign-in (unchanged path) |
| `littleantsenglish.com/tv` | Opens the classroom TV screen (`teacher.…/screen`) |
| `teacher.` · `admin.` · `api.` · `media.` | Teacher, Admin, API, media bucket |

## Outcome and acceptance

- A visitor who is not signed in sees the landing page in Vietnamese; **EN** switches to `/en` and is remembered.
  Both pages are server-rendered, with title, description and a share picture (Open Graph).
- A parent who has signed in on this device and opens the root lands in the app without seeing the landing page;
  the installed app opens `/app` directly. Offline, `/app` still opens from the service worker.
- **Watch on TV** on a TV browser shows the classroom pairing code (Chrome 92 era browsers included).
- All apps answer on the new hostnames; sign-in (staff and parents) works there; old `la-*.passionedu.org`
  addresses redirect to the new ones, except what Google Cast needs until its console is updated.
- Media keeps playing: units published before the move still use `la-media.passionedu.org`, which stays connected.
- Lighthouse on the landing page: performance ≥ 90 on mobile, accessibility ≥ 95.

Non-goals: home TV mode for parents, a CMS for the landing copy, translating the apps.

## Phases

| # | Phase | Depends on | Effort |
|---|-------|-----------|--------|
| 1 | [Landing page and the app at /app](phase-01-landing-page.md) | – | 1.5d |
| 2 | [TV entry](phase-02-tv-entry.md) | 1 | 0.25d |
| 3 | [Move to littleantsenglish.com](phase-03-domain-move.md) | 1, 2 | 1d |

## Risks

- **Sign-in on the new domain.** Staff cookies are shared via `AUTH_COOKIE_DOMAIN`; the change signs everyone
  out once. Parent cookies stay on the API host, so parents sign in again too. Tell teachers and parents first.
- **Google Cast receiver** is registered at `https://la-teacher.passionedu.org/cast-receiver`. Until the Cast
  console points at the new address, the old Teacher host must keep serving `/cast-receiver` (no redirect there).
- **Installed apps** belong to the old origin: parents reinstall from the new address, and offline downloads do
  not carry over.
- **Media URLs are stored in published releases.** Keep `la-media.passionedu.org` on the bucket; new publishes use
  `media.littleantsenglish.com`.
