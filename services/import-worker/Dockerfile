# import-worker runtime image. Same shape as services/email-worker/Dockerfile.
#
# Cloud Run Pub/Sub push entrypoint — exposes :8080 (Cloud Run injects
# PORT; defaults to 8080). Processes CSV import jobs from import_jobs.raw_rows,
# writing per-row results to import_job_rows.

FROM node:24-alpine

RUN apk add --no-cache dumb-init

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/events ./packages/events
# @sparx/commerce's checkout-service/return-service import @sparx/payments at
# module load; payments' only workspace dep is @sparx/db (above). Without it the
# image builds but crashes at runtime with ERR_MODULE_NOT_FOUND on '@sparx/payments'.
COPY packages/payments ./packages/payments
# @sparx/commerce's market services (docs/106 §4.7) import @sparx/channels/crypto at
# module load (payout encryption); channels is dep-free (node builtins only).
COPY packages/channels ./packages/channels
COPY packages/commerce ./packages/commerce
# @sparx/commerce re-exports inventoryService from @sparx/inventory at module load.
COPY packages/inventory ./packages/inventory
# @sparx/commerce-schemas (pure markup engine) is a dep of both @sparx/commerce
# and now @sparx/crm (quote-line markup, docs/48 §5).
COPY packages/commerce-schemas ./packages/commerce-schemas
COPY packages/modules ./packages/modules
COPY packages/crm ./packages/crm
COPY packages/crm-schemas ./packages/crm-schemas
COPY packages/api-core ./packages/api-core
COPY services/import-worker ./services/import-worker

RUN pnpm install --filter @sparx/import-worker... --frozen-lockfile --prod=false

RUN cd packages/db && pnpm exec prisma generate

WORKDIR /app/services/import-worker

RUN chown -R node:node /app
USER node

EXPOSE 8080

ENTRYPOINT ["dumb-init", "--", "node", "--import", "tsx", "src/index.ts"]
