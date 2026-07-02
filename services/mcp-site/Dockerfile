# Site MCP server (docs/113). Unlike api-mcp, this service bundles NO
# module packages and touches NO database — it is a thin MCP adapter over the
# public REST API. Its dependency closure is therefore tiny: just the shared
# @sparx/site-mcp catalog (which depends only on zod) plus the service.
#
# Runtime is `node --import tsx` (NOT pnpm exec) — corepack/pnpm are build-time
# only, per services/CLAUDE.md.

FROM node:24-alpine

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Workspace root files first (better layer caching).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./

# The whole dependency closure of @sparx/mcp-site:
#   @sparx/mcp-site → @sparx/site-mcp → (zod only)
COPY packages/site-mcp packages/site-mcp
COPY services/mcp-site services/mcp-site

RUN pnpm install --filter @sparx/mcp-site... --frozen-lockfile --prod=false

WORKDIR /app/services/mcp-site

RUN chown -R node:node /app
USER node

EXPOSE 3200

ENTRYPOINT ["node", "--import", "tsx", "src/index.ts"]
