#!/bin/sh
# Configure an rclone remote called "r2" from the same S3_* variables the API uses.
# Sourced by backup.sh and restore.sh.
set -eu

: "${S3_ENDPOINT:?S3_ENDPOINT is required}"
: "${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID is required}"
: "${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY is required}"
: "${BACKUP_BUCKET:=${S3_BUCKET:?S3_BUCKET or BACKUP_BUCKET is required}}"
: "${DATABASE_URL:?DATABASE_URL is required}"

export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ENDPOINT="$S3_ENDPOINT"
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

BACKUP_PREFIX="${BACKUP_PREFIX:-backups/postgres}"
REMOTE="r2:${BACKUP_BUCKET}/${BACKUP_PREFIX}"

