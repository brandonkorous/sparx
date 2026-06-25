# channel-sync-worker runtime image.
# Cloud Run Pub/Sub push entrypoint — exposes :8080.
# Subscribes to product.*, inventory.adjusted, and order.fulfilled and pushes the
# change out to every connected channel with a registered adapter (docs/106 §4.2).

FROM node:24-alpine

RUN apk add --no-cache dumb-init

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/channels ./packages/channels
COPY packages/events ./packages/events
COPY services/channel-sync-worker ./services/channel-sync-worker

RUN pnpm install --filter @sparx/channel-sync-worker... --frozen-lockfile --prod=false

RUN cd packages/db && pnpm exec prisma generate

WORKDIR /app/services/channel-sync-worker

RUN chown -R node:node /app
USER node

EXPOSE 8080

ENTRYPOINT ["dumb-init", "--", "node", "--import", "tsx", "src/index.ts"]
