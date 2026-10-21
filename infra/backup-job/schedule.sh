#!/bin/sh
# Run backup.sh once a day at BACKUP_HOUR_UTC (default 19 UTC = 02:00 in Vietnam).
set -eu
HOUR="${BACKUP_HOUR_UTC:-19}"
echo "Backup job started; daily backup at ${HOUR}:00 UTC."
while true; do
  now=$(date -u +%s)
  next=$(date -u -d "today ${HOUR}:00" +%s)
  [ "$next" -le "$now" ] && next=$(date -u -d "tomorrow ${HOUR}:00" +%s)
  sleep $((next - now))
  backup.sh nightly || echo "Backup FAILED at $(date -u)" >&2
done
