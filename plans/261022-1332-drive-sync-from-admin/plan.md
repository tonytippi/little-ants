---
status: done
created: 2026-10-22
---

# Drive sync from Admin

While the curriculum is being finished, Google Drive is the source of truth. Admins press **Sync from Google Drive** in Admin; a worker imports every unit from Drive (overwriting Admin edits) and the result shows in Admin.

## Outcome and acceptance

- An admin can request a sync in Admin and follow it (queued → running → done/failed) with the import report.
- Only one sync is queued or running at a time; non-admins cannot request or view syncs.
- A sync re-imports all units with files, overwriting Admin edits (`--force`), backs up the database first and archives the Drive files (existing importer behaviour).
- Re-importing replaces the importer's draft-layout links with the files now on Drive; files people uploaded in Admin stay linked.
- The worker runs as its own service on the VPS (importer image, has `pg_dump`); the API only records requests.
- If the worker restarts mid-run, the run is marked failed instead of staying "running".

Non-goals: importing `FINAL` pictures and audio (separate task), scheduled syncs, partial (per-unit) sync from Admin.

## Phases

1. **Data model**: `ImportRun` table (status, requester, times, progress message, report, archive prefix). Back up before migrating.
2. **Importer**: move the run logic out of the CLI into `runImport()`; worker loop (`la-import --worker`) that claims queued runs; replace stale draft-layout links. Tests: link replacement, worker lifecycle.
3. **API**: `imports` module, ADMIN only: list, get (with report), create (409 when one is active). e2e tests.
4. **Admin**: "Drive sync" page with the button, warning, run list with live status and report.
5. **Infra and docs**: `import-worker` compose service, development and deploy docs.

## Risks

- A sync overwrites Admin edits by design; the page says so before the admin confirms.
- Teachers keep seeing the last published release until a unit is published again; the page says so.

## Result

All phases done. Verification: `pnpm turbo lint typecheck test build` passes (importer 34 tests including link replacement and worker lifecycle; API 30 including the imports e2e). Not yet exercised end to end against Drive through the worker; the Docker image is unbuilt locally (Docker in WSL is broken).
