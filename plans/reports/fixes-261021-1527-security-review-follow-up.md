# Security review follow-up

Source: [code-reviewer-261021-1520-platform-security-review.md](./code-reviewer-261021-1520-platform-security-review.md). Every finding except one product question was fixed and covered by tests.

| Finding | Fix | Test |
|---|---|---|
| H1 CSRF + SVG | Global `originCheck` on every state-changing request (Origin must be an app origin; cross-site requests without Origin refused). SVG removed from allowed uploads. Local files served with `nosniff` and a sandbox CSP. Production refuses the local storage driver. | `origin-check.e2e.test.ts` |
| M1 drafts public on R2 | Two buckets: private `S3_BUCKET` for all uploads, public `S3_PUBLIC_BUCKET` behind the media domain. Approving an asset (single, bulk or whole unit) copies it to the public bucket first. | storage unit tests |
| M2 upload size | Presigned PUT signs `Content-Length`; `complete` deletes and rejects a file whose size differs from the announced size. | storage unit test |
| M3 `complete` twice | `complete` is idempotent; a second concurrent replacement gets 409. | `content.e2e.test.ts` |
| M4 silent relink | Replacing a file re-points links and gives each affected material/word a revision and a new draft state. | `content.e2e.test.ts` |
| M5 publish race | Publish runs in one transaction with an advisory lock and `FOR SHARE` locks on the unit's content rows. | covered by publish e2e |
| M6 teacher notes | Content, assets, releases and teacher notes require AUTHOR or REVIEWER. | `content.e2e.test.ts` |
| M7 shared devices | Outbox records carry their owner; sign-out uploads once more, asks before discarding unsent records, then clears cached personal data. | `sync-batches.test.ts` |
| M8 all-or-nothing sync | Server answers per record (`accepted` / `rejected` with reason); client uploads in batches of 150. | `content.e2e.test.ts`, `sync-batches.test.ts` |
| M9 edits during review | Editing an item in review sends it back to draft, so approval always matches what the reviewer saw. | `content-versioning.test.ts` |
| L1 nextLesson race | Atomic conditional update, only for newly stored runs. | `content.e2e.test.ts` |
| L2 role-less users | Guard refuses accounts without roles; role list cannot be emptied. | `origin-check.e2e.test.ts`, DTO tests |
| L3 importer overwrites | `--force` turns reviewed content into a new draft; re-import keeps gate sign-offs. | `import-unit.test.ts` |
| L4 broken import asset | Row created as not uploaded; failed uploads are retried on the next run. | – |
| L5 production env | Requires https API URL and origins, Google credentials, `STORAGE_DRIVER=s3`. | – |
| L6 rate-limit IP | Better Auth uses `CF-Connecting-IP` only. | – |
| L7 Prisma 500s | Global filter: P2025 → 404, P2002/P2003 → 409. | `org.e2e.test.ts` |

Also fixed from the Teacher worker's report: zod `.partial()` filled defaults on PATCH (update schemas now have no defaults; tests in `dto-partial-updates.test.ts` and `org.e2e.test.ts`).

Verification: `pnpm turbo lint typecheck test build` → 30/30 tasks pass (API 27 e2e tests, importer 21, db 6, shared 17, storage 7, teacher unit tests).

## Unresolved questions

- May a reviewer approve content they edited themselves? There is no "author ≠ approver" rule yet.
