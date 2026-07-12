#!/bin/sh
set -eu

backup="${1:-}"
if [ -z "$backup" ] || [ ! -f "$backup" ]; then
  echo "Usage: sh /scripts/restore.sh /backups/kinfolk-TIMESTAMP.dump" >&2
  exit 1
fi

echo "Restoring ${backup} into ${PGDATABASE}. Existing Kinfolk database objects will be replaced."
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$PGDATABASE" "$backup"
echo "Restore completed."
