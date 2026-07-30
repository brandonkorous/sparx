# platform-crm-worker runtime image. Same shape as services/legal-seed-worker.
#
# Cloud Run Pub/Sub push entrypoint — exposes :8080 (Cloud Run injects PORT;
# defaults to 8080). No native deps required.

FROM node:24-alpine

RUN apk add --no-cache dumb-init

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Workspace context — the transitive closure of @sparx/platform-crm:
#   platform-crm → crm, db, modules
#   crm          → commerce-schemas, crm-schemas, db, modules
#   commerce-schemas → crm-schemas
#   modules      → db
# plus @sparx/events for the event contract. A missing COPY here type-checks
# fine and then crashes the container at boot, so keep this list in step with
# each package.json.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/events ./packages/events
COPY packages/modules ./packages/modules
COPY packages/crm-schemas ./packages/crm-schemas
COPY packages/commerce-schemas ./packages/commerce-schemas
COPY packages/crm ./packages/crm
COPY packages/platform-crm ./packages/platform-crm
COPY services/platform-crm-worker ./services/platform-crm-worker

# Filtered install pulls only @sparx/platform-crm-worker + transitive workspace
# deps; --prod=false keeps tsx + @types/* available for the runtime entry.
RUN pnpm install --filter @sparx/platform-crm-worker... --frozen-lockfile --prod=false

# Generate Prisma client up front so the first message doesn't pay the cost.
RUN cd packages/db && pnpm exec prisma generate

WORKDIR /app/services/platform-crm-worker

# Run as non-root (GKE Autopilot policy). node:24-alpine ships uid 1000.
RUN chown -R node:node /app
USER node

EXPOSE 8080

# dumb-init forwards SIGTERM to the graceful-shutdown hook. Run tsx directly via
# node (matches the `start` script), not `pnpm exec` — pnpm re-invokes corepack
# at container start, re-downloading pnpm on every cold start.
ENTRYPOINT ["dumb-init", "--", "node", "--import", "tsx", "src/index.ts"]
