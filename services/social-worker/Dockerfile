# social-worker runtime image (docs/133). Same shape as services/push-worker/Dockerfile.
#
# Cloud Run Pub/Sub push entrypoint — exposes :8080 (Cloud Run injects PORT;
# defaults to 8080). Needs @sparx/db (post/target/connection rows), @sparx/social
# (adapters, renderer, token crypto), and @sparx/events (publishing the result event).

FROM node:24-alpine

RUN apk add --no-cache dumb-init

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Workspace context — minimum needed to install social-worker + its transitive
# workspace deps (db, social, events, attribution; all dependency-free themselves).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/social ./packages/social
COPY packages/events ./packages/events
COPY packages/attribution ./packages/attribution
COPY services/social-worker ./services/social-worker

# Filtered install pulls only @sparx/social-worker + transitive workspace deps;
# --prod=false keeps tsx + @types/* available for the runtime entry.
RUN pnpm install --filter @sparx/social-worker... --frozen-lockfile --prod=false

# Generate Prisma client up front so the first message doesn't pay the cost.
RUN cd packages/db && pnpm exec prisma generate

WORKDIR /app/services/social-worker

# Run as non-root (GKE Autopilot policy). node:24-alpine ships uid 1000.
RUN chown -R node:node /app
USER node

EXPOSE 8080

# dumb-init forwards SIGTERM to the graceful-shutdown hook. Run tsx via node
# (matches `start`), not `pnpm exec` (which re-invokes corepack at cold start).
ENTRYPOINT ["dumb-init", "--", "node", "--import", "tsx", "src/index.ts"]
