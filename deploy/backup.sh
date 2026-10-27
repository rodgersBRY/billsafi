#!/usr/bin/env sh
# Nightly Postgres dump kept for 14 days. Run from cron on the droplet:
#   15 2 * * * /opt/billsafi/backup.sh >> /home/deploy/backup.log 2>&1
# These files live on the droplet's own disk; copy them off the droplet too (see deploy/README.md).
# Each run, good or bad, also adds a row to the backup_runs table so the admin Health page can
# show the last good backup (D066). The row holds only the time, size, file name and a short
# error line. Recording never makes a good backup fail.
set -eu

cd "$(dirname "$0")"
mkdir -p backups
started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
name="billsafi-$(date -u +%Y%m%dT%H%M%SZ).dump"
file="backups/${name}"
finished=0

# record STATUS SIZE_BYTES FILE_NAME ERROR. Empty values are stored as null.
record() {
  docker compose exec -T postgres psql -U billsafi -d billsafi -q -v ON_ERROR_STOP=1 \
    -v started="${started}" -v status="$1" -v size="$2" -v file_name="$3" -v error="$4" <<'SQL' ||
insert into backup_runs (started_at, finished_at, status, size_bytes, file_name, error)
values (:'started'::timestamptz, now(), :'status', nullif(:'size', '')::bigint,
        nullif(:'file_name', ''), nullif(:'error', ''));
SQL
    echo "Warning: could not record the backup run in the database" >&2
}

# On any failure before the dump is in place, remove the partial file and record the failure.
on_exit() {
  code=$?
  trap - EXIT
  if [ "${code}" -ne 0 ] && [ "${finished}" -eq 0 ]; then
    rm -f "${file}.partial"
    record failed "" "" "Backup failed with exit code ${code}"
  fi
  exit "${code}"
}
trap on_exit EXIT

docker compose exec -T postgres pg_dump -U billsafi -d billsafi --format=custom > "${file}.partial"
mv "${file}.partial" "${file}"
finished=1
size="$(wc -c < "${file}" | tr -d ' ')"
record succeeded "${size}" "${name}" ""
find backups -name 'billsafi-*.dump' -mtime +14 -delete

echo "Backup written to ${file}"
