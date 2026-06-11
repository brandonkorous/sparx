# api-rest runtime image. Same shape as packages/db/Dockerfile:
#   - single stage, node:24-alpine
#   - pnpm via corepack
#   - workspace context limited to api-rest + the packages it depends on so
#     `pnpm install --filter` doesn't drag the entire monorepo into the image
#   - runs tsx from the entrypoint; no separate compile step (the Prisma
#     client is the only generated artifact, baked in via `prisma generate`
#     against @sparx/db).
#
# Built by GitHub Actions, pushed to
# us-central1-docker.pkg.dev/sparxworks/sparx/api-rest:<sha>.

FROM node:24-alpine

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Workspace context.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/dropship ./packages/dropship
COPY packages/auth ./packages/auth
COPY packages/email ./packages/email
COPY packages/events ./packages/events
COPY packages/api-core ./packages/api-core
COPY packages/cms-schemas ./packages/cms-schemas
COPY packages/crm-schemas ./packages/crm-schemas
COPY packages/crm ./packages/crm
COPY packages/commerce-schemas ./packages/commerce-schemas
COPY packages/integration-framework ./packages/integration-framework
COPY packages/legal ./packages/legal
COPY packages/legal-templates ./packages/legal-templates
COPY packages/search ./packages/search
COPY packages/seo-audit ./packages/seo-audit
COPY packages/commerce ./packages/commerce
COPY packages/provider-stripe ./packages/provider-stripe
COPY packages/provider-shippo ./packages/provider-shippo
COPY packages/customer-auth ./packages/customer-auth
COPY packages/site-themes ./packages/site-themes
COPY packages/surface-compile ./packages/surface-compile
COPY packages/sitebuilder-schemas ./packages/sitebuilder-schemas
COPY packages/sitebuilder ./packages/sitebuilder
COPY packages/builder-schemas ./packages/builder-schemas
COPY packages/builder ./packages/builder
COPY packages/blueprints ./packages/blueprints
COPY packages/marketplace-schemas ./packages/marketplace-schemas
COPY packages/cms-editor ./packages/cms-editor
COPY packages/email-platform ./packages/email-platform
COPY packages/godaddy ./packages/godaddy
COPY services/api-rest ./services/api-rest

# First-party marketplace bundles (docs/85). Read at ingest time by
# src/scripts/marketplace-ingest.ts (run as a one-off Job — see
# k8s/sparx-prod/marketplace-ingest-job.yaml + .github/workflows/marketplace-ingest.yml).
# The script resolves repoRoot/marketplace-catalog → /app/marketplace-catalog.
# ~6MB of sources + screenshots; baked in so the Job needs no extra fetch.
COPY marketplace-catalog ./marketplace-catalog

# Install only what api-rest needs (and transitive workspace deps).
RUN pnpm install --filter @sparx/api-rest... --frozen-lockfile --prod=false

# Pre-generate the Prisma client so the first request doesn't pay the cost.
RUN cd packages/db && pnpm exec prisma generate

WORKDIR /app/services/api-rest

# k8s SecurityContext requires runAsNonRoot. node:24-alpine ships a `node`
# user (uid 1000) which satisfies the GKE Autopilot policy.
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Run tsx directly via node (matches the `start` script). NOT through pnpm:
# `pnpm exec` re-invokes corepack at container start, and corepack's per-user
# cache (prepared as root at build time) is unreadable by the runtime `node`
# user — so it re-downloaded pnpm from the npm registry on every cold start.
# `node --import tsx/esm` keeps corepack out of the runtime path entirely.
# Fastify handles SIGTERM via the graceful-shutdown hook in src/index.ts.
ENTRYPOINT ["node", "--import", "tsx", "src/index.ts"]
