# dropship-worker runtime image.
# Cloud Run Pub/Sub push entrypoint — exposes :8080.
# Handles dropship.supplier.sync_started and dropship.order.route events.

FROM node:24-alpine

RUN apk add --no-cache dumb-init

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/dropship ./packages/dropship
COPY packages/events ./packages/events
COPY services/dropship-worker ./services/dropship-worker

RUN pnpm install --filter @sparx/dropship-worker... --frozen-lockfile --prod=false

RUN cd packages/db && pnpm exec prisma generate

WORKDIR /app/services/dropship-worker

RUN chown -R node:node /app
USER node

EXPOSE 8080

ENTRYPOINT ["dumb-init", "--", "node", "--import", "tsx", "src/index.ts"]
