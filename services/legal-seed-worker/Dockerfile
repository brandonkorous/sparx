# legal-seed-worker runtime image. Same shape as services/email-worker/Dockerfile.
#
# Cloud Run Pub/Sub push entrypoint — exposes :8080 (Cloud Run injects PORT;
# defaults to 8080). No native deps required.

FROM node:24-alpine

RUN apk add --no-cache dumb-init

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Workspace context — minimum needed to install legal-seed-worker + its
# workspace deps (@sparx/db for the writes, @sparx/events for the event type,
# @sparx/legal-seed for the shared seeding logic, which itself pulls in
# @sparx/legal-templates for the starter content).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/events ./packages/events
COPY packages/legal-seed ./packages/legal-seed
COPY packages/legal-templates ./packages/legal-templates
COPY services/legal-seed-worker ./services/legal-seed-worker

# Filtered install pulls only @sparx/legal-seed-worker + transitive workspace
# deps; --prod=false keeps tsx + @types/* available for the runtime entry.
RUN pnpm install --filter @sparx/legal-seed-worker... --frozen-lockfile --prod=false

# Generate Prisma client up front so the first message doesn't pay the cost.
RUN cd packages/db && pnpm exec prisma generate

WORKDIR /app/services/legal-seed-worker

# Run as non-root (GKE Autopilot policy). node:24-alpine ships uid 1000.
RUN chown -R node:node /app
USER node

EXPOSE 8080

# dumb-init forwards SIGTERM to the graceful-shutdown hook. Run tsx directly via
# node (matches the `start` script), not `pnpm exec` — pnpm re-invokes corepack
# at container start, re-downloading pnpm on every cold start.
ENTRYPOINT ["dumb-init", "--", "node", "--import", "tsx", "src/index.ts"]
