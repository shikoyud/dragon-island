# syntax=docker/dockerfile:1
# Dragon Island game server. Build from the repo root:
#   docker build -f apps/server/Dockerfile -t dragon-island-server .
# The server runs TypeScript through tsx (workspace packages are source-only), so tsx stays installed.

FROM node:22-bookworm-slim AS base
# pnpm comes from corepack at the version pinned in the root package.json ("packageManager").
# COREPACK_HOME is outside /root so the non-root runtime user can use the prepared pnpm too.
ENV COREPACK_HOME=/opt/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    PNPM_HOME=/opt/pnpm
WORKDIR /app
COPY package.json ./
RUN corepack enable \
 && corepack install \
 && chmod -R a+rX "$COREPACK_HOME"

FROM base AS deps
# Every workspace manifest, so the frozen lockfile matches; only the server and its workspace
# dependencies (game-core, shared) are installed.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY apps/waitlist/package.json apps/waitlist/
COPY packages/game-core/package.json packages/game-core/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm-store,target=/opt/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /opt/pnpm/store --filter "@wyrmhaven/server..."

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps --chown=node:node /app /app
COPY --chown=node:node tsconfig.base.json ./
COPY --chown=node:node packages/game-core packages/game-core
COPY --chown=node:node packages/shared packages/shared
# src plus drizzle/ (the SQL migrations that db:migrate and startup apply).
COPY --chown=node:node apps/server apps/server
WORKDIR /app/apps/server
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# One-off commands run in the same image, e.g. `docker compose run --rm server pnpm db:migrate`.
CMD ["./node_modules/.bin/tsx", "src/index.ts"]
