#!/bin/sh
# Dump the database and upload it to R2, then delete backups older than BACKUP_RETENTION_DAYS (default 30).
# Usage: backup.sh [label]
set -eu
. "$(dirname "$0")/rclone-env.sh"

LABEL="${1:-nightly}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="/tmp/little-ants-${STAMP}-${LABEL}.dump"

pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --exclude-schema='test*' --file="$FILE"
rclone copyto "$FILE" "${REMOTE}/$(basename "$FILE")"
rm -f "$FILE"
rclone delete --min-age "${BACKUP_RETENTION_DAYS:-30}d" "$REMOTE"
echo "Backup uploaded: ${REMOTE}/$(basename "$FILE")"
