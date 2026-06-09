# b2b-overdue-worker runtime image.
# Cloud Run cron job triggered by Cloud Scheduler — no Pub/Sub push.
# Exposes :8080 (PORT env var). Only needs @sparx/db and @sparx/events.

FROM node:24-alpine

RUN apk add --no-cache dumb-init

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/events ./packages/events
COPY services/b2b-overdue-worker ./services/b2b-overdue-worker

RUN pnpm install --filter @sparx/b2b-overdue-worker... --frozen-lockfile --prod=false

RUN cd packages/db && pnpm exec prisma generate

WORKDIR /app/services/b2b-overdue-worker

RUN chown -R node:node /app
USER node

EXPOSE 8080

ENTRYPOINT ["dumb-init", "--", "node", "--import", "tsx", "src/index.ts"]
