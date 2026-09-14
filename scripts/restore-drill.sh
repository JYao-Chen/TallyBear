#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
DB_CONTAINER=${DB_CONTAINER:-tallybear-db}
DB_USER=${DB_USER:-tallybear}
DB_NAME=${DB_NAME:-tallybear}
backup=${1:?Pass a completed backup directory}
test -s "$backup/database.dump"
test -s "$backup/receipts.tar.gz"
drill="tallybear_restore_$(date +%s)"
restore_dir=$(mktemp -d /tmp/tallybear-restore.XXXXXX)
cleanup(){ docker exec "$DB_CONTAINER" dropdb -U "$DB_USER" --if-exists "$drill" >/dev/null; rm -rf -- "$restore_dir"; }
trap cleanup EXIT
docker exec "$DB_CONTAINER" createdb -U "$DB_USER" "$drill"
docker exec -i "$DB_CONTAINER" pg_restore -U "$DB_USER" -d "$drill" --exit-on-error < "$backup/database.dump"
tar -xzf "$backup/receipts.tar.gz" -C "$restore_dir"
# Older backups predate opt-in retention; their receipts were all permanent.
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$drill" -v ON_ERROR_STOP=1 -c 'ALTER TABLE receipt_files ADD COLUMN IF NOT EXISTS temporary boolean NOT NULL DEFAULT false' >/dev/null
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$drill" -v ON_ERROR_STOP=1 -Atc 'SELECT id FROM receipt_files WHERE NOT temporary' > "$restore_dir/receipt-list"
# Every durable receipt must exist in the restored archive.
while IFS= read -r id; do test -s "$restore_dir/receipts/$id"; done < "$restore_dir/receipt-list"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$drill" -v ON_ERROR_STOP=1 -Atc 'SELECT count(*) AS restored_transactions FROM transactions; SELECT count(*) AS restored_receipts FROM receipt_files;'
printf 'Restore drill passed; production was not modified.\n'
