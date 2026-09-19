#!/usr/bin/env bash
# Dumps the Supabase Postgres database to backups/, gzip'd, and keeps
# only the last 7 backups. Run from the project root (needs `pg_dump`
# and DATABASE_URL in .env — use the Session/Direct connection string):
#   ./scripts/backup.sh
#
# Supabase also provides managed backups in the dashboard; this script
# is an optional extra dump on the EC2 host.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example and set DATABASE_URL first." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set in .env" >&2
  exit 1
fi

mkdir -p backups

timestamp="$(date +%Y%m%d-%H%M%S)"
outfile="backups/${timestamp}.sql.gz"

pg_dump "$DATABASE_URL" | gzip > "$outfile"

echo "Wrote $outfile"

# Keep only the 7 most recent backups.
ls -1t backups/*.sql.gz | tail -n +8 | xargs -r rm --
