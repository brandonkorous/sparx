# domain-worker runtime image. Subscribes to domain.purchased via Pub/Sub push,
# polls CNAME propagation, marks domains active, and sends renewal reminders.
#
# Cloud Run push endpoint — exposes :8080 (PORT env var). Only needs @sparx/db
# and @sparx/events from the workspace; no UI, media, or email-render deps.

FROM node:24-alpine

RUN apk add --no-cache dumb-init

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/events ./packages/events
COPY services/domain-worker ./services/domain-worker

RUN pnpm install --filter @sparx/domain-worker... --frozen-lockfile --prod=false

RUN cd packages/db && pnpm exec prisma generate

WORKDIR /app/services/domain-worker

RUN chown -R node:node /app
USER node

EXPOSE 8080

ENTRYPOINT ["dumb-init", "--", "node", "--import", "tsx", "src/index.ts"]
