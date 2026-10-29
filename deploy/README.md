# Dragon Island deploy runbook (single VPS)

One VPS runs three containers from `deploy/docker-compose.yml`:

| Service | What | Reachable from |
|---|---|---|
| `caddy` | TLS, serves the web build (`apps/web/dist`), proxies `/api/*` to `server:3000` with the prefix stripped (same as `apps/web/vite.config.ts`) | internet, ports 80/443 |
| `server` | game server image from `apps/server/Dockerfile` (tsx, non-root, `NODE_ENV=production`) | compose network only |
| `postgres` | `postgres:16`, data in the `pgdata` volume | compose network only (no published port) |

Chain: **Robinhood Chain testnet, chain ID 46630, only.** Nothing in this bundle deploys contracts or broadcasts transactions; the server refuses any other chain id.

Files you create on the VPS (all git-ignored, `chmod 600`, never committed):

| File | From | Holds |
|---|---|---|
| `deploy/.env` | `deploy/.env.example` | `PLAY_DOMAIN`, `POSTGRES_PASSWORD` (compose variables) |
| `deploy/.env.server` | `deploy/.env.server.example` | the server's config, including signer/operator keys and `ADMIN_TOKEN` |
| `deploy/backup.env` | `deploy/backup.env.example` | backup recipient (public key), R2 remote, identity path |

All commands below run on the VPS from `/opt/dragon-island/deploy` unless stated otherwise.

## 1. Install Docker

Ubuntu/Debian: follow https://docs.docker.com/engine/install/ (the apt repository method), then:

```bash
docker version && docker compose version     # Compose v2 plugin required
sudo apt-get install -y age rclone git       # backups; rclone >= 1.59 for the R2 provider
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw allow 443/udp && sudo ufw enable
sudo git clone <repo-url> /opt/dragon-island
```

Postgres and the server publish no ports, so only Caddy is exposed. Optional hardening: allow 80/443 only from Cloudflare's ranges (https://www.cloudflare.com/ips/).

## 2. Cloudflare DNS for `play.` (proxied), Caddy gets TLS

1. In Cloudflare DNS add `A play -> <VPS IPv4>` (and `AAAA` if the VPS has IPv6). Create it **DNS only (grey cloud)** for now, so Let's Encrypt reaches Caddy directly the first time.
2. SSL/TLS mode: **Full (strict)** (Cloudflare checks Caddy's real certificate).
3. After step 7 (`docker compose up -d`) Caddy obtains the certificate on its own; check `docker compose logs caddy | grep -i "certificate obtained"` and `curl -sI https://play.<domain>/`.
4. Then switch the record to **Proxied (orange cloud)**. Caddy renews over HTTP-01 on port 80 through Cloudflare. If a renewal ever fails (Caddy logs `acme` errors), flip the record to DNS only for a few minutes while Caddy retries, or move Caddy to the Cloudflare DNS challenge.

Client IPs: Cloudflare's proxied traffic hits Caddy. The Caddyfile trusts `CF-Connecting-IP` **only** from Cloudflare's published ranges (`trusted_proxies`), then overwrites `X-Forwarded-For` with that single client IP before proxying. The server runs with `TRUST_PROXY=true` and takes that value for rate limits and referral overlap checks. Anyone hitting the origin directly is identified by their socket address, so the header can't be spoofed. Keep the range list in the Caddyfile in sync with https://www.cloudflare.com/ips/. Turning Cloudflare's proxy off breaks nothing.

## 3. Copy `.env.server` (and the other env files, and the web build)

```bash
cd /opt/dragon-island/deploy
cp .env.example .env && cp .env.server.example .env.server && cp backup.env.example backup.env
chmod 600 .env .env.server backup.env
```

- `.env`: `PLAY_DOMAIN=play.<domain>`, `POSTGRES_PASSWORD=$(openssl rand -hex 32)`.
- `.env.server`: put the **same** password into `DATABASE_URL`; fresh `SESSION_SECRET` and `ADMIN_TOKEN` (`openssl rand -hex 32` each); `SIWE_DOMAIN=play.<domain>`, `SIWE_URI=https://play.<domain>`; after the testnet contracts are deployed, `VAULT_ADDRESS`, `TOKEN_ADDRESS`, `SIGNER_PRIVATE_KEY`, `OPERATOR_PRIVATE_KEY`, `INDEXER_START_BLOCK` (the vault's deploy block), and your RPC provider URL; `ALERT_WEBHOOK_URL`, `SENTRY_DSN`. Leave `E2E=0`. `BETA_CLOSED=true` takes effect once the closed-beta allowlist ships (Task 5).
- **`RPC_URL` with an embedded API key** can appear in server logs and Sentry error text (viem includes the URL in request errors). Use a key restricted to this app, and rotate it if logs leak.

**Web build.** `apps/web/dist` is mounted read-only into Caddy, so build it on your workstation and sync it over. `VITE_*` values are compiled into public JavaScript: never put a secret in them.

```bash
# on your workstation, repo root, same commit as the VPS checkout
VITE_CHAIN_ID=46630 VITE_RPC_URL=https://rpc.testnet.chain.robinhood.com \
VITE_VAULT_ADDRESS=0x... VITE_TOKEN_ADDRESS=0x... \
VITE_REOWN_PROJECT_ID=... VITE_SENTRY_DSN=... \
pnpm --filter @wyrmhaven/web build
rsync -a --delete apps/web/dist/ <user>@<vps>:/opt/dragon-island/apps/web/dist/
```

Leave `VITE_API_URL` unset (it defaults to `/api`). Re-sync whenever the web changes; Caddy serves the new files immediately (no restart).

## 4. `docker compose up -d postgres`

```bash
docker compose build server          # builds apps/server/Dockerfile from the repo root
docker compose up -d postgres
docker compose ps                    # postgres: healthy
```

## 5. `docker compose run --rm server pnpm db:migrate`

```bash
docker compose run --rm server pnpm db:migrate     # prints "migrations applied"
```

`db:migrate` applies `apps/server/drizzle/` to `DATABASE_URL` and refuses to run without it (it never falls back to PGlite). The server also migrates on start; running it first surfaces migration errors before the game is up.

## 6. Season backfill on any restored or reused database

**Required whenever the database is not brand new**: a restored backup, the beta database, or any database the server has been off for. Otherwise the close job would pay prizes for every old ended season on first boot. Skip it only for an empty database created in step 4.

The server must still be stopped (this is before step 7). Pass a cutoff **at least 5 minutes in the past**: the backfill ignores the close job's 5-minute grace, so a season that ended within the last 5 minutes must be left to the close job.

```bash
CUTOFF="$(date -u -d '-10 minutes' +%Y-%m-%dT%H:%M:%SZ)"
docker compose run --rm server pnpm season:backfill -- --ended-before "$CUTOFF"           # dry run: lists seasons
docker compose run --rm server pnpm season:backfill -- --ended-before "$CUTOFF" --apply   # writes
```

The backfill marks those seasons closed without paying prizes. Note that it runs migrations first, **even on a dry run**. It exits 1 if the season-close lock is busy (a server is running against the database): stop it and retry.

## 7. `docker compose up -d`

```bash
docker compose up -d
docker compose ps                                   # server: healthy, caddy: running
curl -fsS https://play.<domain>/api/health          # {"ok":true}
docker compose logs -f server                       # Ctrl-C to stop following
```

Then finish step 2.4 (switch DNS to proxied) and set the token price via `POST /api/admin/price` with the `x-admin-token` header.

**Updating:** `git pull`, re-sync the web build if it changed, then `docker compose build server && docker compose up -d`. New migrations apply on start; run step 5 first if you want to see them separately.

## 8. Cron: `backup.sh` nightly, `restore-drill.sh` weekly

One-time setup:

```bash
age-keygen -o /root/.config/dragon-island/backup-age.key     # mkdir -p the dir first; chmod 600
age-keygen -y /root/.config/dragon-island/backup-age.key     # public key -> BACKUP_AGE_RECIPIENT
rclone config     # new remote "r2": type s3, provider Cloudflare, an R2 API token scoped to the bucket
                  # (Object Read & Write), endpoint https://<account-id>.r2.cloudflarestorage.com
```

Fill `backup.env`. Store an **offline copy of the age identity** (password manager or paper): without it no backup can be decrypted. Keeping the identity on the VPS lets the drill run there, but means a VPS compromise also exposes the backups; to avoid that, run `restore-drill.sh` from another machine that has the identity and a compose checkout instead.

- `backup.sh`: `pg_dump -Fc` inside the postgres container, encrypted with `age` to the public key (only ciphertext touches disk), uploaded to `<remote>/daily/`; Sunday runs also copy to `<remote>/weekly/`. Keeps the newest 14 daily and 8 weekly dumps. Uploads nothing unless the whole dump succeeded.
- `restore-drill.sh`: streams the newest daily dump through `age -d` into a scratch database `restore_drill_<timestamp>`, prints `restore drill OK: <file> -> players = <n>`, then drops the scratch database. Any failure exits non-zero. Set `RESTORE_MIN_PLAYERS` once you have players so an empty restore fails too.

Both use `docker compose exec postgres ...`, so the host needs only Docker, `age` and `rclone`. Run them as root (or a user in the `docker` group that owns the identity file):

```cron
PATH=/usr/local/bin:/usr/bin:/bin
MAILTO=<your-email>
15 3 * * *  /opt/dragon-island/deploy/backup.sh        >> /var/log/dragon-island-backup.log 2>&1
45 4 * * 1  /opt/dragon-island/deploy/restore-drill.sh >> /var/log/dragon-island-restore.log 2>&1
```

Run both by hand once before trusting cron. Optional: set `BACKUP_HEARTBEAT_URL` to an UptimeRobot heartbeat monitor so a missed backup alerts you.

**Restoring for real** (data loss, new VPS): stop the server (`docker compose stop server`), recreate the database (`docker compose exec postgres dropdb -U dragon dragon && docker compose exec postgres createdb -U dragon dragon`), stream the chosen dump in with `rclone cat <remote>/daily/<file> | age -d -i <identity> | docker compose exec -T postgres pg_restore -U dragon -d dragon --no-owner --exit-on-error`, **then run step 6 (season backfill)**, then step 7.

## 9. UptimeRobot on `https://play.<domain>/api/health`

HTTP(s) monitor, 5-minute interval, keyword `"ok":true` (or status 200). `/health` queries the database and returns 503 when it is unreachable, so this catches a dead server, a dead database, and a broken Caddy/DNS/TLS chain. Alert contacts: see section 11.

## 10. Pausing the vault

Pausing stops `enter`, `deposit`, `claim` and operator `burn` on the vault. The **operator** can pause; only the owner **Safe** (2-of-3) can unpause.

Pause, from WSL with Foundry, using an encrypted keystore (never a raw key on the command line or in shell history):

```bash
# once: import the operator key into a Foundry keystore (prompts for the key and a password)
cast wallet import dragon-operator --interactive

export VAULT=0x...    # VAULT_ADDRESS from .env.server
cast send "$VAULT" "pause()" --account dragon-operator \
  --rpc-url https://rpc.testnet.chain.robinhood.com --chain 46630
cast call "$VAULT" "paused()(bool)" --rpc-url https://rpc.testnet.chain.robinhood.com   # true
```

While paused, claims (withdrawals), deposits and the burn job fail on chain; the server keeps running and its voucher-expiry job refunds unclaimed vouchers as usual. To freeze the game too: `docker compose stop server`.

Unpause: once the cause is fixed (and any leaked signer/operator key has been rotated by the Safe), a Safe signer proposes a transaction calling `unpause()` on the vault in the Safe app on chain 46630, and a second signer confirms and executes it.

## 11. Who to call

Fill this in before launch and keep it current. Do not commit phone numbers or private contact details to the repo; keep the filled-in copy in the team password manager.

| Situation | Who | How |
|---|---|---|
| Anything, first | On-call owner: `<name>` | `<channel>` |
| Vault must be paused | Operator key holder: `<name>` | `<channel>` |
| Unpause, rotate signer/operator, Safe transactions | Safe signers: `<signer 1>`, `<signer 2>`, `<signer 3>` (2 of 3 needed) | `<channel>` |
| VPS down / disk / network | VPS provider support | `<support URL>` |
| DNS / TLS / proxy | Cloudflare account owner: `<name>` | `<channel>` |
| RPC outage or rate limits | RPC provider | `<support URL>` |
| Chain-watch alerts | Discord alert channel (`ALERT_WEBHOOK_URL`) | `<channel>` |

## Troubleshooting

- `docker compose logs --tail 200 server` / `caddy` / `postgres`. Logs rotate at 10 MB x 5 per container.
- `/api/health` 503: database unreachable; `docker compose ps postgres`, disk space (`df -h`).
- Caddy certificate errors: DNS must point at the VPS, port 80 open, and (first issuance) the record DNS only.
- Server exits at start with a zod error: a key in `.env.server` is missing or malformed (see the comments in `.env.server.example`). `E2E=1` is refused together with `NODE_ENV=production` or a `DATABASE_URL`.
