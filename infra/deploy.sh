#!/bin/sh
# Deploy the current checkout on the VPS:
#   1. build images   2. back up the database   3. run migrations   4. restart services   5. health check
# Usage (from the repository root): infra/deploy.sh
set -eu

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f infra/docker-compose.prod.yml --env-file .env.production"
TAG="$(git rev-parse --short HEAD)"
export IMAGE_TAG="$TAG"

echo "Building images for $TAG"
$COMPOSE build

echo "Backing up the database before migrating"
$COMPOSE up -d postgres
$COMPOSE run --rm backup backup.sh "before-deploy-$TAG"

echo "Applying database migrations"
$COMPOSE --profile tools run --rm migrate

echo "Starting services"
# The import services mount the Drive mirror; create it as the host user, not as root by Docker.
mkdir -p "docs/Little Ants English"
$COMPOSE up -d --remove-orphans

echo "Waiting for the API to report healthy"
for _ in $(seq 1 30); do
  if $COMPOSE exec -T api node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    echo "Deployed $TAG"
    exit 0
  fi
  sleep 2
done
echo "The API did not become healthy. Roll back with: IMAGE_TAG=<previous tag> $COMPOSE up -d" >&2
exit 1
