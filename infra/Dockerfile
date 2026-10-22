# syntax=docker/dockerfile:1.7
# One Dockerfile, one target per service: api, migrate, importer, admin, teacher.
# Build from the repository root:  docker build -f infra/Dockerfile --target api .

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# Install dependencies from manifests only, so code changes do not bust this layer.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/teacher/package.json apps/teacher/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/storage/package.json packages/storage/
COPY packages/ui/package.json packages/ui/
COPY tools/importer/package.json tools/importer/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Public URLs are baked into the browser bundles at build time.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_TEACHER_APP_URL
# Versions the Teacher app service worker so each deploy refreshes offline caches.
ARG BUILD_ID=local
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_TEACHER_APP_URL=$NEXT_PUBLIC_TEACHER_APP_URL BUILD_ID=$BUILD_ID
RUN pnpm turbo run build --filter=@little-ants/api... --filter=@little-ants/admin... --filter=@little-ants/teacher...

# Database migrations (needs the Prisma CLI, a dev dependency).
FROM build AS migrate
CMD ["pnpm", "--filter", "@little-ants/db", "run", "migrate:deploy"]

# One-off curriculum import: Google Drive → database + R2. It backs up the database first,
# so it needs pg_dump matching the server (PostgreSQL 17).
FROM build AS importer
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-17 \
  && rm -rf /var/lib/apt/lists/*
RUN pnpm turbo run build --filter=@little-ants/importer...
CMD ["pnpm", "--filter", "@little-ants/importer", "run", "la-import", "--drive", "--all", "--assets"]

FROM build AS api-prune
RUN pnpm prune --prod --ignore-scripts

FROM node:24-bookworm-slim AS api
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=api-prune /repo /repo
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]

# Next.js standalone servers (next.config sets outputFileTracingRoot to the repository root).
FROM node:24-bookworm-slim AS admin
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node /repo/apps/admin/.next/standalone ./
COPY --from=build --chown=node /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build --chown=node /repo/apps/admin/public ./apps/admin/public
USER node
EXPOSE 3000
CMD ["node", "apps/admin/server.js"]

FROM node:24-bookworm-slim AS teacher
ENV NODE_ENV=production PORT=3002 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node /repo/apps/teacher/.next/standalone ./
COPY --from=build --chown=node /repo/apps/teacher/.next/static ./apps/teacher/.next/static
COPY --from=build --chown=node /repo/apps/teacher/public ./apps/teacher/public
USER node
EXPOSE 3002
CMD ["node", "apps/teacher/server.js"]
