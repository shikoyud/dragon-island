#!/usr/bin/env bash
# Nightly encrypted Postgres backup: pg_dump -Fc -> age (public key) -> rclone (Cloudflare R2).
# Keeps the newest 14 daily dumps and, from Sunday runs, the newest 8 weekly copies.
#
# Runs pg_dump inside the compose `postgres` container (socket auth, no password needed), so the
# host only needs docker, age and rclone. No secrets live here: the age recipient is a PUBLIC key
# and the R2 credentials stay in rclone's own config (~/.config/rclone/rclone.conf).
#
# Configuration (environment, or deploy/backup.env which this script sources if present):
#   BACKUP_AGE_RECIPIENT   age public key, age1...            (required)
#   BACKUP_RCLONE_REMOTE   rclone remote and path, e.g. r2:dragon-island-backups   (required)
#   BACKUP_KEEP_DAILY      default 14
#   BACKUP_KEEP_WEEKLY     default 8
#   BACKUP_HEARTBEAT_URL   optional; fetched after a successful run (UptimeRobot heartbeat etc.)
#   PGUSER / PGDATABASE    default dragon / dragon (match docker-compose.yml)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${BACKUP_ENV_FILE:-$SCRIPT_DIR/backup.env}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi

: "${BACKUP_AGE_RECIPIENT:?set BACKUP_AGE_RECIPIENT (age public key)}"
: "${BACKUP_RCLONE_REMOTE:?set BACKUP_RCLONE_REMOTE (e.g. r2:dragon-island-backups)}"
KEEP_DAILY="${BACKUP_KEEP_DAILY:-14}"
KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-8}"
PGUSER="${PGUSER:-dragon}"
PGDATABASE="${PGDATABASE:-dragon}"
REMOTE="${BACKUP_RCLONE_REMOTE%/}"
COMPOSE=(docker compose -f "$SCRIPT_DIR/docker-compose.yml")

log() { printf '%s backup: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }

# Deletes all but the newest $2 files under remote dir $1 (names sort by their UTC timestamp).
prune() {
  local dir="$1" keep="$2" f
  local -a files
  mapfile -t files < <(rclone lsf --files-only "$dir/" | grep -E '\.dump\.age$' | sort -r)
  for f in "${files[@]:keep}"; do
    log "pruning $dir/$f"
    rclone deletefile "$dir/$f"
  done
}

umask 077
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

NAME="dragon-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
OUT="$WORK/$NAME"

# Only ciphertext touches the disk. The whole pipeline must succeed before anything is uploaded,
# so a dump cut short by an error never lands in the bucket looking like a valid backup.
log "dumping $PGDATABASE"
"${COMPOSE[@]}" exec -T postgres pg_dump -U "$PGUSER" -d "$PGDATABASE" -Fc \
  | age -r "$BACKUP_AGE_RECIPIENT" -o "$OUT"
if [[ ! -s "$OUT" ]]; then
  log "empty dump, aborting"
  exit 1
fi

log "uploading $NAME ($(wc -c < "$OUT") bytes)"
rclone copyto "$OUT" "$REMOTE/daily/$NAME"
if [[ "$(date -u +%u)" == 7 ]]; then
  log "sunday: weekly copy"
  rclone copyto "$REMOTE/daily/$NAME" "$REMOTE/weekly/$NAME"
fi

prune "$REMOTE/daily" "$KEEP_DAILY"
prune "$REMOTE/weekly" "$KEEP_WEEKLY"

if [[ -n "${BACKUP_HEARTBEAT_URL:-}" ]]; then
  curl -fsS -m 10 -o /dev/null "$BACKUP_HEARTBEAT_URL" || log "heartbeat failed (backup itself succeeded)"
fi
log "done: $NAME"
