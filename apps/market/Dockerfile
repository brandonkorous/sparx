# syntax=docker/dockerfile:1.7
#
# Multi-stage Next.js build for @sparx/market — the public sparx.market shopping
# destination. Mirrors apps/site/Dockerfile (same standalone output shape), but a
# much smaller workspace subgraph: apps/market renders NO tenant themes and NO
# builder. Its UI layer is silicaui (silicaui + silicaui-react, from npm — NOT a
# workspace package, so no COPY here; pnpm install pulls them from the registry),
# leaving @sparx/commerce-schemas (which pulls @sparx/crm-schemas) as its only
# workspace dep. There is no @sparx/site-ui stylesheet build step.
#
# Built from the repo root context (per .github/workflows/build-images.yml):
#   docker build -f apps/market/Dockerfile -t sparx/market:tag .

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# ----- Install + build -----
FROM base AS builder

# Workspace metadata first — maximises layer cache reuse across source changes.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/market/package.json apps/market/
# @sparx/commerce-schemas (pure-zod: MARKET_CATEGORIES + the category taxonomy)
# and its only workspace dep, @sparx/crm-schemas. silicaui + silicaui-react are
# npm deps resolved by pnpm install below, so they need no COPY.
COPY packages/commerce-schemas/package.json packages/commerce-schemas/
COPY packages/crm-schemas/package.json packages/crm-schemas/

# Install only the @sparx/market subgraph (its deps + transitive workspace deps).
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @sparx/market...

COPY packages/commerce-schemas packages/commerce-schemas
COPY packages/crm-schemas packages/crm-schemas
COPY apps/market apps/market

# next.config.mjs has `output: 'standalone'` and outputFileTracingRoot pointing
# at the monorepo root for this to work.
RUN pnpm --filter @sparx/market build

# ----- Production runner -----
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# Standalone bundle includes the minimal node_modules + server.js for the app.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/market/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/market/.next/static ./apps/market/.next/static
# public/ is NOT bundled into standalone output — copy it explicitly so the
# default favicon fallback (favicon.ico, sparx-icon.svg) serves.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/market/public ./apps/market/public

# Next's incremental data cache lives at <distDir>/cache (apps/market/.next/cache).
# The standalone output ships .next/{standalone,static} but NOT a cache dir, so at
# runtime the dir is absent — Next can't read/write the fetch Data Cache, which
# silently degrades `next: { revalidate }` fetches. Create it writable up front.
RUN mkdir -p ./apps/market/.next/cache \
 && chown -R nextjs:nodejs ./apps/market/.next

USER nextjs

EXPOSE 3000

CMD ["node", "apps/market/server.js"]
