# Phase 3: Parent identity and Google sign-in

## Context

Staff use better-auth (`user`, `session`, `account`) with Google and invites. Parents must be separate. Reference
implementation: `../anhhoa/apps/api/src/modules/auth/auth.service.ts` (Google OIDC: state + nonce in
`OAuthTransaction`, ID token checked against Google JWKS: signature, iss, aud, azp, nonce, exp, email_verified;
Google `sub` bound on first login) and `../anhhoa/apps/api/src/modules/parents/parents.service.ts` (`admit`,
`authorizedParent`). Do not copy its test-only ID-token bypass; tests stub the JWKS/token exchange instead.

## Schema

- `Parent`: id, email (normalized, unique), googleSub (unique, nullable until first sign-in), name, phone,
  createdAt, lastSignInAt.
- `StudentParent`: studentId, parentId, relationship (free text, optional), createdAt. `@@unique([studentId,
  parentId])`. Removing the link deletes the row (audit log entry).
- `ParentSession`: id, parentId, tokenHash (unique), deviceLabel (from user agent: "iPhone · Safari"), createdAt,
  lastSeenAt, expiresAt (30 days absolute, 7 days idle, refreshed at most hourly).
- `ParentOAuthTransaction`: stateHash, nonceHash, correlation, expiresAt (10 min), consumedAt.

## Behaviour

- `GET /api/parent/auth/google/start` → Google; `GET /api/parent/auth/google/callback` → checks, then admit:
  a `Parent` with that email exists and has at least one linked child with an active enrollment; otherwise
  "This Google account is not registered with a school" (no session).
- Device limit: if the parent already has 2 live sessions, the callback creates no session and redirects to a page
  listing the 2 devices; the parent picks one to sign out (short-lived signed ticket authorises that one action),
  then the new session is created.
- Cookie `la_parent` (httpOnly, Secure, SameSite=Lax), host-only on the API: only the API reads it, and the student
  app (same site) sends it with credentialed requests. Writes are protected by the API's existing `originCheck`
  (Origin must be an app origin) instead of a separate CSRF token.
- Sign-ins of one parent run under a per-parent advisory lock, so devices signing in at once cannot pass the limit;
  signing in again on the same browser replaces that browser's session. The return path is resolved and must stay
  on the student app's origin.
- Every parent request: load session → parent → for the requested child: link exists and child active. Child left
  → 403 for that child's data at once. Parent with no active child left → sessions deleted.
- `GET /api/parent/me` (children with studied units), `GET/DELETE /api/parent/sessions` (own devices), `POST
  /api/parent/auth/logout`.
- Staff side (phase 2 Admin): parent emails per child; adding an email creates or reuses `Parent` and the link.

## Steps

1. Schema + migration (backup first).
2. `parent-auth` module: Google client (token exchange + JWKS verification via `jose`), sessions, guard
   `@ParentSession()` decorator, CSRF check.
3. Endpoints above; `GOOGLE_PARENT_REDIRECT_URI` setting (same OAuth client, extra redirect URI).
4. Tests: callback rejects bad state/nonce/aud/unverified email; unknown email refused; third device refused then
   allowed after signing one out; child leaving locks access; staff cookies do not work on parent routes and vice
   versa.
5. Early manual check on an iPad home-screen app (risk in plan.md).
