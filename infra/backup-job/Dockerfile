# Small backup job: pg_dump (same major version as the server) + rclone for R2.
FROM postgres:17-bookworm
RUN apt-get update \
  && apt-get install -y --no-install-recommends rclone ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY rclone-env.sh backup.sh restore.sh schedule.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/schedule.sh
ENTRYPOINT []
CMD ["schedule.sh"]
