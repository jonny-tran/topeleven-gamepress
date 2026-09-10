# Fly.io deploys the Bun + Elysia server from this image.
# Single-stage keeps Bun workspace symlinks intact at runtime.
FROM oven/bun:1.4-alpine

WORKDIR /repo

ENV CI=true
ENV NODE_ENV=production
ENV PORT=3000

# 1) Workspace manifests
COPY package.json bun.lock* turbo.json ./
COPY apps/server/package.json        ./apps/server/package.json
COPY apps/web/package.json           ./apps/web/package.json
COPY packages/api/package.json       ./packages/api/package.json
COPY packages/auth/package.json      ./packages/auth/package.json
COPY packages/db/package.json        ./packages/db/package.json
COPY packages/env/package.json       ./packages/env/package.json
COPY packages/ui/package.json        ./packages/ui/package.json
COPY packages/config/package.json    ./packages/config/package.json

# 2) Source for those workspaces
COPY apps/server ./apps/server
COPY apps/web    ./apps/web
COPY packages    ./packages

# 3) Install the whole monorepo once
RUN bun install --ignore-scripts

# 4) Build the server bundle
WORKDIR /repo/apps/server
RUN bun run build

# 5) Run as a non-root user
RUN addgroup -S app && adduser -S app -G app
USER app

WORKDIR /repo/apps/server
EXPOSE 3000

CMD ["bun", "run", "start"]
