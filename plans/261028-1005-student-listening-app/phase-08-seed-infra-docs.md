# Phase 8: Seed, infrastructure and docs

## Steps

1. `seed-test` (apps/api/src/cli/test-data.ts): school "Little Ants Test School" with campus "Mio Lingo", class
   "Unit 5" running U05 (unit history U04 → U05 to exercise studied units), the eight test children with
   enrollments, all teachers as TEACHER of the school, and test parents from `SEED_TEST_PARENT_EMAILS` (comma
   separated, linked to the first children) so real Google accounts can sign in.
2. Compose: `student` service (Next standalone, 127.0.0.1:9204), `NEXT_PUBLIC_STUDENT_APP_URL`, add
   `https://la-student.passionedu.org` to `CORS_ORIGINS`, `GOOGLE_PARENT_REDIRECT_URI`.
3. One-time manual steps for the user: Cloudflare Tunnel hostname `la-student.passionedu.org` → `localhost:9204`;
   add redirect URI `https://la-api.passionedu.org/api/parent/auth/google/callback` to the Google OAuth client.
4. Docs: `docs/development.md` (new app, env vars, parent test sign-in), `docs/operations/deploy-and-restore.md`
   (tunnel host, redirect URI, roles), architecture notes on schools/enrollments/parents.
5. Deploy only when every phase passes `pnpm turbo lint typecheck test build` and the user agrees.
