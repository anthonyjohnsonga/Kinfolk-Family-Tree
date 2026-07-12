#!/bin/sh
set -eu

interval="${BACKUP_INTERVAL_SECONDS:-86400}"
retention="${BACKUP_RETENTION_DAYS:-30}"

case "$interval" in *[!0-9]*|'') echo "BACKUP_INTERVAL_SECONDS must be a positive integer" >&2; exit 1;; esac
case "$retention" in *[!0-9]*|'') echo "BACKUP_RETENTION_DAYS must be a non-negative integer" >&2; exit 1;; esac

mkdir -p /backups

while true; do
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  temporary="/backups/kinfolk-${timestamp}.dump.partial"
  destination="/backups/kinfolk-${timestamp}.dump"

  echo "Creating PostgreSQL backup ${destination}"
  if pg_dump --format=custom --compress=6 --file="$temporary"; then
    mv "$temporary" "$destination"
    echo "Backup completed: ${destination}"
  else
    rm -f "$temporary"
    echo "Backup failed" >&2
  fi

  find /backups -type f -name 'kinfolk-*.dump' -mtime "+${retention}" -print -delete
  sleep "$interval"
done
