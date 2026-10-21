# Little Ants platform — security & correctness review (2026-10-21)

## Scope
- apps/api/src (all controllers, auth, bootstrap, config, storage), packages/storage/src, packages/db/src/content-versioning.ts + schema models, tools/importer/src/write-unit.ts + assets.ts, apps/teacher/public/sw.js + src/lib (outbox, local-db, queries, session, media-cache), infra prod env/compose/R2 CORS, docs/operations.
- No git history: source reviewed directly. `pnpm turbo test` → 10/10 tasks pass (API 21 tests, importer 20). No e2e coverage for `/teach/sync`, teacher-notes, asset `complete` retries, or cross-site requests.

## Verified OK (risk calibration only)
- Global `AuthGuard` via `APP_GUARD`; only `health`, `auth-config`, `storage/*` are `@Public`. Session resolver re-reads `active` + `roles` per request; deactivation deletes sessions.
- Better Auth mounted before JSON parser; CORS registered before it; invite gate in `user.create.before`; deactivated users blocked in `session.create.before`; dev password login refused in production by env refinement.
- Class scoping in `org.controller` (`getClass`, `listClasses`) and `teach.controller` (`observations`, `runs`, `sync` incl. student↔class check) is correct.
- Approval: `assertCanSetStatus` + asset `assertStatusChange` require REVIEWER/ADMIN for `APPROVED`; `approve-all` and `releases` are `@Roles('REVIEWER')`.
- `LocalStorage.filePath` traversal guard, HMAC with `timingSafeEqual`, content-type bound into upload signature, public local route requires `APPROVED` DB row.
- Service worker never caches API responses; media cache only holds release media URLs.

---

## High

### H1. Bodyless state-changing POSTs are CSRF-able from any same-site origin; combined with SVG uploads an AUTHOR can make a REVIEWER approve a whole unit
- `apps/api/src/content/units.controller.ts:280-285` (`approve-all`), `:272-277` (`submit-all`), `apps/api/src/assets/assets.controller.ts:143-145` (`complete`) take no body. `apps/api/src/bootstrap.ts:16-20` only adds CORS + a JSON parser; nothing checks `Origin`/custom header for non-GET API routes (Better Auth's origin check covers `/api/auth/*` only).
- `packages/shared/src/dto/content.ts:181` allows `image/svg+xml` uploads. In production the media domain is `media.littleants.vn` (`infra/env.production.example:33`), i.e. **same-site** with `api.littleants.vn`, and session cookies are scoped to `.littleants.vn` (`auth.ts:204`, SameSite=Lax default) → Lax cookies are sent on same-site POSTs.
- Scenario: an AUTHOR uploads `poster.svg` containing `<script>fetch('https://api.littleants.vn/api/content/units/U03/approve-all',{method:'POST',mode:'no-cors',credentials:'include'})</script>`. It is reachable at `media.<domain>` (see M1, drafts are public on R2) or via the signed URL. A reviewer opens the file from Admin → simple request (no preflight), cookie attached, every REVIEW item + assets in the unit become APPROVED. The CORS layer hides the response but does not stop execution. With `STORAGE_DRIVER=local` the SVG is served from the API origin itself (`local-storage.controller.ts:280-287`), giving full same-origin XSS against the API.
- Fix (do both): (a) global guard/middleware rejecting non-GET/HEAD/OPTIONS requests whose `Origin` (or `Sec-Fetch-Site`) is not in `CORS_ORIGINS`, or require a custom header such as `X-Requested-With`; (b) drop `image/svg+xml` from `ASSET_MIME_TYPES` or serve SVG with `Content-Disposition: attachment` + `Content-Security-Policy: sandbox` and `X-Content-Type-Options: nosniff` (local driver and R2 object metadata). Long term, host media on a separate registrable domain.

## Medium

### M1. R2 custom domain exposes every object, including DRAFT/REVIEW/ARCHIVED files; "approved files only" is enforced only in local mode
- `packages/storage/src/s3-storage.ts:232-234`, `docs/operations/deploy-and-restore.md:7,17` (custom domain on the whole media bucket). Drafts are uploaded into the same bucket under `assets/<id>/v<n>/<name>` (`assets.controller.ts:137`, importer `assets.ts:49-50`).
- Scenario: any storage key that leaks (asset ids/keys are returned to every signed-in staff member, including TEACHER, by `GET /api/assets`), or a file that was APPROVED and then ARCHIVED/withdrawn, stays publicly downloadable forever with `immutable` caching. The local driver's `publicFile` status check gives a false sense of parity.
- Fix: put unapproved uploads under a prefix not served by the custom domain (e.g. `private/…`, block it with a Cloudflare WAF/Transform rule) and copy to `public/…` on approval; or use two buckets. At minimum update docs to state drafts are public-by-URL.

### M2. Upload size limit is not enforced for presigned S3/R2 uploads
- `packages/storage/src/s3-storage.ts:218-224` signs only `ContentType`; `assets.controller.ts:146-155` accepts whatever `head()` reports and stores it. `MAX_ASSET_BYTES` (200 MB) is only checked for the declared `sizeBytes` and in the local driver.
- Scenario: an author (or a leaked 15-minute upload URL) PUTs a multi-GB object; `complete` records it; the Teacher PWA's "Download unit" then pulls it onto iPads.
- Fix: sign `ContentLength: body.sizeBytes` in the `PutObjectCommand` (R2 enforces signed `content-length`), and in `complete()` reject + `storage.delete()` when `stored.sizeBytes > MAX_ASSET_BYTES` or `!== asset.sizeBytes`.

### M3. `POST /assets/:id/complete` is not idempotent — a retry breaks the version chain
- `apps/api/src/assets/assets.controller.ts:150-154`: `previousId: replacesId` where `replacesId = asset.pendingReplacesId`, which the first call already set to `null`.
- Scenario: browser retries `complete` after a timeout → second call writes `previousId: null` → new version loses its link, the old version again has `next: null` and reappears as "latest" in `GET /assets` (`:60`), version history in `detail` is gone. Two concurrent replacements of the same asset both pass the `previous.next` check (`:118-120`); the second `complete` hits the `previousId @unique` constraint → 500 and a stuck `uploaded:false` row.
- Fix: if `asset.uploaded` is already true, return `detail(id)` without writing; only set `previousId` when `replacesId` is non-null; map P2002 to 409.

### M4. Replacing a file silently changes APPROVED content without a revision or re-review, and the next release drops it
- `apps/api/src/assets/assets.controller.ts:156-163` re-points `materialAsset`, `materialPage`, `word`, `character` links (across all units) to the new DRAFT asset with no `stateAfterEdit`, no revision, no status change.
- Scenario: an APPROVED song material gets a new audio version; material stays APPROVED v1; `release-builder.service.ts:105-108` excludes non-approved assets and `check()` only emits a warning (`:87`) → the next published release ships the lesson without its audio. Also bypasses "editing approved content starts a new draft" (docs/development.md:70) and is invisible to the importer's `hasManualEdits`.
- Fix: inside the same transaction, for each affected content row apply `stateAfterEdit` + `writeRevision` (or keep links on the old version until the new one is approved).

### M5. Publish is check-then-build without a transaction — unapproved content can be published; concurrent publishes 500
- `apps/api/src/releases/release-builder.service.ts:183-193`: `check()` then a second `loadUnit()` in `build()`; `build()` filters only `NOT_ARCHIVED` (`:33-43`), not `APPROVED`.
- Scenario: author saves a lesson (APPROVED → DRAFT v2 via `stateAfterEdit`) between check and build → DRAFT text ships to every teacher in an immutable release. Two reviewers publishing at once compute the same `version` → `@@unique([unitId, version])` P2002 → 500.
- Fix: run check + build + create in one `$transaction({ isolationLevel: 'RepeatableRead' })` on the same loaded snapshot (have `check` and `build` share one `loadUnit` result) and map P2002 to 409.

### M6. Teacher notes from every class are readable by any signed-in staff, including teachers of other classes
- `apps/api/src/teach/teach.controller.ts:136-148`: `TeacherNotesController` has no `@Roles`; the doc comment says it is for program leads. `LessonRun.notes` is free text (3000 chars) that teachers routinely write about specific children.
- Scenario: a TEACHER calls `GET /api/content/units/U01/teacher-notes` and reads notes + class names for all campuses, bypassing the class scoping enforced everywhere else (Decree 13 data minimisation).
- Fix: `@Roles('AUTHOR', 'REVIEWER')` (ADMIN passes implicitly), or scope by `canAccessClass` for teachers.

### M7. Teacher PWA leaves children's data and the outbox behind on sign-out of a shared device
- `apps/teacher/src/lib/session.tsx:339-347` clears only `kv['me']`. `queries.ts:12-23` stores `get:/teach/classes` (student names) and per-class observation responses in IndexedDB `kv`; outbox (`local-db.ts`) is not user-scoped.
- Scenarios: (a) Teacher B signs in on the classroom iPad, goes offline, opens `/observe?class=<A's class>` → `cachedGet` returns teacher A's cached class roster/observations. (b) A's unsynced outbox is uploaded under B's session: if B co-teaches, records are stored with `teacherId = B` (`teach.controller.ts:116,120`, misattribution); otherwise the whole batch 403s and B's own records are marked failed (M8).
- Fix: on sign-out, flush the outbox first (warn if items remain), then `clear()` the `kv` store; tag outbox items and kv keys with `user.id` and only send/read entries for the current user.

### M8. One bad record (or >2000 queued observations) permanently fails the entire outbox
- Server: `teach.controller.ts:106-107` throws 403 for the whole request if any `classId` is inaccessible; `packages/shared/src/dto/content.ts:224-227` caps 200 runs / 2000 observations → 400. Client: `apps/teacher/src/lib/outbox.ts:110-133` sends all due items in one request and `sync-policy.ts:433` maps 400/403 to `rejected`, marking **every** item failed; `discardFailed` then deletes them.
- Scenario: teacher is unassigned from class A while holding offline records for A; next sync also carries today's class B observations → all are flagged failed and can be discarded. A long offline period with >2000 taps has the same effect.
- Fix: client chunks (≤200 runs / ≤500 observations per request); server returns per-record rejections (filter inaccessible classes like it already filters mismatched students) instead of failing the batch.

### M9. Edits during REVIEW keep status and version, so reviewers approve content they never saw
- `packages/db/src/content-versioning.ts:16-21` (`REVIEW` stays `REVIEW`, same version) + `changeContentStatus` (`:88-105`) / `setUnitStatus` (`content.service.ts:72-103`) approve whatever is current, with no expected-version check.
- Scenario: reviewer opens lesson v3 in REVIEW, author changes teacher text, reviewer clicks Approve → the unseen text is APPROVED and publishable. Revisions also get duplicate `version` numbers.
- Fix: either reset REVIEW → DRAFT on edit, or require `expectedVersion`/`updatedAt` in status-change bodies and reject on mismatch (optimistic concurrency).

## Low

- **L1. `POST /teach/sync` nextLesson is read-modify-write** (`teach.controller.ts:123-128`): two concurrent syncs for the same class can move `nextLesson` backwards; replays also re-advance after an admin reset. Fix: `updateMany({ where: { id, nextLesson: { lte: run.lessonNumber }, currentUnit: { code } }, data: { nextLesson: min(n+1, 40) } })` and only for runs actually inserted.
- **L2. Users with no roles pass every un-annotated route** (`auth.guard.ts:148-149`): `roles: []` happens if `acceptInvite` fails after user creation (`auth.ts:218-220`, not in the create transaction) or an admin PATCHes `roles: []` (`staffUpdate` has no `.min(1)`). Such a user reads all content, assets (signed URLs), revisions and teacher notes. Fix: guard rejects `roles.length === 0`; `staffUpdate.roles.min(1)`.
- **L3. Importer `--force` rewrites APPROVED content in place** (`tools/importer/src/write-unit.ts:82-86, 96-100, 145-149, 194-198`) keeping status/version; `hasManualEdits` ignores gate-check sign-offs and production status edits (no revisions) so a plain re-import wipes them (`:163-173, 226-227`). Fix: apply `stateAfterEdit` on changed rows; include `gateCheck.doneAt`/production edits in the manual-edit check.
- **L4. Importer asset row created before upload** (`tools/importer/src/assets.ts:38-51`): `uploaded` defaults to true, so a failed `storage.put` leaves a visible broken asset that checksum dedupe (`:34-35`) reuses forever. Fix: create with `uploaded:false`, flip after put, and ignore `uploaded:false` rows in dedupe.
- **L5. Production env refinements incomplete** (`apps/api/src/config/env.ts:95-103`): `CORS_ORIGINS`/`trustedOrigins` and `API_PUBLIC_URL` silently default to `http://localhost:*` in production; Google creds are optional. Fix: in production require https `API_PUBLIC_URL`, non-localhost `CORS_ORIGINS`, Google creds.
- **L6. Better Auth rate limit keyed on spoofable `X-Forwarded-For`** behind Cloudflare. Fix: `advanced.ipAddress.ipAddressHeaders: ['cf-connecting-ip']`.
- **L7. Prisma not-found/FK errors return 500** (e.g. `org.controller.ts:62,121,155,167,177`, `staff.controller.ts:245`, `items.controller.ts:223`, `restore` `lessonInput.parse` at `:262`). Add a Prisma exception filter (P2025→404, P2003/P2002→409/400).

## Recommended actions (priority)
1. H1: origin/custom-header CSRF guard for all mutating routes; remove or sandbox SVG.
2. M6 `@Roles` on teacher notes; M7 sign-out cleanup + per-user outbox.
3. M1/M2: private prefix or bucket for unapproved media; sign ContentLength + verify in `complete`.
4. M3/M4/M5: make `complete` idempotent and versioning-aware; transactional publish.
5. M8/M9: per-record sync results + client chunking; optimistic concurrency on approval.
6. Add e2e tests: cross-origin POST rejected, teacher-notes 403 for TEACHER, `complete` called twice, publish racing an edit, sync with one inaccessible class.

## Metrics
- Tests: 41 passing (API 21, importer 20); no tests for sync, teacher notes, CSRF, or upload retries.
- Lint/typecheck: not re-run (turbo cache reported green).

## Unresolved questions
- Is REVIEWER self-approval of own edits acceptable (no author ≠ approver check anywhere)?
- Should TEACHER see draft content/assets via `GET /content/*` and `GET /assets` (signed URLs)? This makes the preview-endpoint restriction to AUTHOR/REVIEWER cosmetic.
- Is the local storage driver ever used outside development? If yes, H1 becomes same-origin XSS on the API.

Status: DONE_WITH_CONCERNS
