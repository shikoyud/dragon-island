#!/usr/bin/env bash
# Weekly restore drill: proves the newest backup actually restores.
# Fetches the newest daily dump from R2, decrypts it with the age identity, restores it into a
# throwaway database in the compose `postgres` container, prints `select count(*) from players`,
# and drops the scratch database. Exits non-zero if any step fails. The live database is never
# touched, and the decrypted dump is streamed, never written to disk.
#
# Configuration (environment, or deploy/backup.env which this script sources if present):
#   BACKUP_RCLONE_REMOTE   rclone remote and path, e.g. r2:dragon-island-backups   (required)
#   BACKUP_AGE_IDENTITY    path to the age identity (private key) file, chmod 600   (required)
#   RESTORE_MIN_PLAYERS    fail if the restored players count is below this (default 0)
#   PGUSER                 default dragon (match docker-compose.yml)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${BACKUP_ENV_FILE:-$SCRIPT_DIR/backup.env}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi

: "${BACKUP_RCLONE_REMOTE:?set BACKUP_RCLONE_REMOTE (e.g. r2:dragon-island-backups)}"
: "${BACKUP_AGE_IDENTITY:?set BACKUP_AGE_IDENTITY (path to the age identity file)}"
MIN_PLAYERS="${RESTORE_MIN_PLAYERS:-0}"
PGUSER="${PGUSER:-dragon}"
REMOTE="${BACKUP_RCLONE_REMOTE%/}"
COMPOSE=(docker compose -f "$SCRIPT_DIR/docker-compose.yml")
SCRATCH="restore_drill_$(date -u +%Y%m%d%H%M%S)"

log() { printf '%s restore-drill: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
pg() { "${COMPOSE[@]}" exec -T postgres "$@"; }

if [[ ! -r "$BACKUP_AGE_IDENTITY" ]]; then
  log "cannot read identity file $BACKUP_AGE_IDENTITY"
  exit 1
fi

NEWEST="$(rclone lsf --files-only "$REMOTE/daily/" | grep -E '\.dump\.age$' | sort | tail -n 1 || true)"
if [[ -z "$NEWEST" ]]; then
  log "no dumps found under $REMOTE/daily/"
  exit 1
fi
log "newest dump: $NEWEST"

cleanup() { pg dropdb -U "$PGUSER" --if-exists "$SCRATCH" || log "WARNING: could not drop $SCRATCH"; }
pg createdb -U "$PGUSER" "$SCRATCH"
trap cleanup EXIT

log "restoring into $SCRATCH"
rclone cat "$REMOTE/daily/$NEWEST" \
  | age -d -i "$BACKUP_AGE_IDENTITY" \
  | pg pg_restore -U "$PGUSER" -d "$SCRATCH" --no-owner --no-privileges --exit-on-error

COUNT="$(pg psql -U "$PGUSER" -d "$SCRATCH" -v ON_ERROR_STOP=1 -tAc 'select count(*) from players')"
COUNT="${COUNT//[[:space:]]/}"
if [[ ! "$COUNT" =~ ^[0-9]+$ ]]; then
  log "unexpected players count: '$COUNT'"
  exit 1
fi
echo "restore drill OK: $NEWEST -> players = $COUNT"
if (( COUNT < MIN_PLAYERS )); then
  log "players count $COUNT is below RESTORE_MIN_PLAYERS=$MIN_PLAYERS"
  exit 1
fi
