# syntax=docker/dockerfile:1.7
#
# Multi-stage Next.js build for @sparx/admin — the WizeWorks operator console.
# Standalone bundle on Node 24 alpine. Built from the repo root context:
#   docker build -f apps/admin/Dockerfile -t sparx/admin:tag .
#
# The dependency closure is deliberately tiny (docs/apps/admin/build-plan.md D6):
# admin imports only @sparx/ui + @sparx/forms + @sparx/operator +
# @sparx/operator-auth (which pulls @sparx/operator + @sparx/events). No
# @sparx/db, no Prisma client — the console holds no tenant business-data DB
# access; it talks to api-rest.

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# ----- Install + build -----
FROM base AS builder

# Workspace metadata first — maximises layer-cache reuse across source changes.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/admin/package.json apps/admin/
COPY packages/ui/package.json packages/ui/
COPY packages/forms/package.json packages/forms/
COPY packages/brand/package.json packages/brand/
COPY packages/operator/package.json packages/operator/
COPY packages/operator-auth/package.json packages/operator-auth/
COPY packages/events/package.json packages/events/

# Install only the @sparx/admin subgraph (its deps + transitive workspace deps).
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @sparx/admin...

# Source for every workspace dep + the app itself.
COPY packages/ui packages/ui
COPY packages/forms packages/forms
COPY packages/brand packages/brand
COPY packages/operator packages/operator
COPY packages/operator-auth packages/operator-auth
COPY packages/events packages/events
COPY apps/admin apps/admin

# Stamp the release version into the client bundle (NEXT_PUBLIC_* is inlined at
# build time). Declared right before the build so a version bump never busts the
# cached dependency/source layers above it.
ARG APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION

RUN pnpm --filter @sparx/admin build

# ----- Production runner -----
FROM node:${NODE_VERSION} AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/admin/.next/static ./apps/admin/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/admin/server.js"]
