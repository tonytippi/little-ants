#!/bin/sh
# Restore a backup from R2.
#   restore.sh --list                 list backups
#   restore.sh <file-name> [target]   restore into TARGET_DATABASE_URL (or DATABASE_URL when target is "live")
# Restoring into the live database replaces its data; take a fresh backup first (deploy.sh does).
set -eu
. "$(dirname "$0")/rclone-env.sh"

if [ "${1:-}" = "--list" ] || [ -z "${1:-}" ]; then
  rclone lsl "$REMOTE" | sort -k2,3
  exit 0
fi

NAME="$1"
TARGET="${2:-scratch}"
if [ "$TARGET" = "live" ]; then
  URL="$DATABASE_URL"
else
  URL="${TARGET_DATABASE_URL:?set TARGET_DATABASE_URL, or pass 'live' to restore over the live database}"
fi

rclone copyto "${REMOTE}/${NAME}" "/tmp/${NAME}"
pg_restore --dbname="$URL" --clean --if-exists --no-owner --exit-on-error "/tmp/${NAME}"
rm -f "/tmp/${NAME}"
echo "Restored ${NAME} into the ${TARGET} database."
