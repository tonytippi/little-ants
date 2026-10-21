---
phase: 1
title: "Monorepo and infrastructure foundation"
status: done
priority: P1
effort: "4d"
dependencies: []
---

# Phase 1: Monorepo and infrastructure foundation

## Goal

One pnpm + Turborepo workspace with the API, Admin and Teacher apps, a shared Prisma package, local
Postgres in Docker, and CI that runs lint, typecheck and tests.

## Key insights

- The project folder is not a git repository yet. `docs/` holds about 104 MB of Office/PDF/PNG files;
  they must not go into git history. Keep them out with `.gitignore` (they are migration input only)
  or move them to R2 storage.
- Admin and Teacher are separate Next.js apps because they target different devices (desktop editor vs
  classroom TV/tablet) and the Teacher app needs a service worker; they share UI and types through
  packages.

## Layout

```
apps/
  api/        NestJS REST API (+ OpenAPI)
  admin/      Next.js (App Router)
  teacher/    Next.js (App Router) + PWA service worker
packages/
  db/         Prisma schema, migrations, client, seed
  shared/     zod schemas and DTO types shared by API and apps
  ui/         shared React components (Tailwind + shadcn/ui)
  api-client/ typed client generated from the API OpenAPI spec
tools/
  importer/   Master Sheet importer CLI (phase 3)
infra/
  docker-compose.yml, docker-compose.prod.yml, cloudflared/, backup/
```

## Tasks and steps

1. `git init`; `.gitignore` covers `node_modules`, `.env*`, `docs/**/*.{docx,xlsx,pdf,png,jpg}`, `~$*`, `.DS_Store`.
2. Create the pnpm workspace and `turbo.json` with `build`, `dev`, `lint`, `typecheck`, `test` pipelines.
3. Scaffold `apps/api` (NestJS 11), `apps/admin` and `apps/teacher` (Next.js 15+), `packages/*`.
4. Shared tooling: TypeScript strict base config, ESLint, Prettier, Vitest (apps/packages) and Jest or
   Vitest for NestJS.
5. `infra/docker-compose.yml` for local dev: `postgres:17`, plus MinIO as a local S3/R2 stand-in.
6. Config: each app reads env through a zod-validated config module; commit `.env.example` only.
7. CI (GitHub Actions): install, lint, typecheck, test, build on every PR.
8. API health endpoint `GET /health` that checks the database.

## Files to create

- `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`
- `apps/api/**`, `apps/admin/**`, `apps/teacher/**`, `packages/{db,shared,ui,api-client}/**`
- `infra/docker-compose.yml`, `.github/workflows/ci.yml`

## Verification

- `pnpm install && pnpm turbo lint typecheck test build` passes.
- `docker compose -f infra/docker-compose.yml up -d` then `curl localhost:3001/health` returns `ok`.
- `git status` shows no files from `docs/` that are Office/PDF/image binaries.

## Risks

- Next.js and NestJS major versions move quickly. Pin exact versions and upgrade on purpose.

## Security

- No secrets in git. Dotenv files stay local; production secrets are set on the VPS only.
