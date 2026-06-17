# inventory-worker runtime image.
# Cloud Run Pub/Sub push entrypoint — exposes :8080.
# Handles inventory.source.sync_started events.

FROM node:24-alpine

RUN apk add --no-cache dumb-init

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/events ./packages/events
COPY packages/crm-schemas ./packages/crm-schemas
COPY packages/commerce-schemas ./packages/commerce-schemas
COPY packages/inventory ./packages/inventory
COPY services/inventory-worker ./services/inventory-worker

RUN pnpm install --filter @sparx/inventory-worker... --frozen-lockfile --prod=false

RUN cd packages/db && pnpm exec prisma generate

WORKDIR /app/services/inventory-worker

RUN chown -R node:node /app
USER node

EXPOSE 8080

ENTRYPOINT ["dumb-init", "--", "node", "--import", "tsx", "src/index.ts"]
