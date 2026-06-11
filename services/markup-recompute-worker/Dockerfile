# markup-recompute-worker runtime image (docs/48 Phase 4). Same shape as
# services/push-worker/Dockerfile.
#
# Cloud Run Pub/Sub push entrypoint — exposes :8080 (Cloud Run injects PORT;
# defaults to 8080). Needs @sparx/db (variant + rule rows), @sparx/commerce-schemas
# (the pure markup engine), and @sparx/events (publishing price.recomputed).

FROM node:24-alpine

RUN apk add --no-cache dumb-init

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Workspace context — minimum needed to install markup-recompute-worker + its
# transitive workspace deps (db, commerce-schemas → crm-schemas, events).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/crm-schemas ./packages/crm-schemas
COPY packages/commerce-schemas ./packages/commerce-schemas
COPY packages/events ./packages/events
COPY services/markup-recompute-worker ./services/markup-recompute-worker

# Filtered install pulls only @sparx/markup-recompute-worker + transitive workspace
# deps; --prod=false keeps tsx + @types/* available for the runtime entry.
RUN pnpm install --filter @sparx/markup-recompute-worker... --frozen-lockfile --prod=false

# Generate Prisma client up front so the first message doesn't pay the cost.
RUN cd packages/db && pnpm exec prisma generate

WORKDIR /app/services/markup-recompute-worker

# Run as non-root (GKE Autopilot policy). node:24-alpine ships uid 1000.
RUN chown -R node:node /app
USER node

EXPOSE 8080

# dumb-init forwards SIGTERM to the graceful-shutdown hook. Run tsx via node
# (matches `start`), not `pnpm exec` (which re-invokes corepack at cold start).
ENTRYPOINT ["dumb-init", "--", "node", "--import", "tsx", "src/index.ts"]
