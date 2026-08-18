# syntax=docker/dockerfile:1.7
#
# Multi-stage Next.js build for @wizeworks/admin — the WizeWorks operator console.
# Standalone bundle on Node 24 alpine. Built from the repo root context:
#   docker build -f wizeworks/apps/admin/Dockerfile -t sparx/admin:tag .
#
# The dependency closure is deliberately tiny (docs/apps/admin/build-plan.md D6):
# admin imports only @wizeworks/ui + @wizeworks/forms + @wizeworks/operator +
# @wizeworks/operator-auth (which pulls @wizeworks/operator + @wizeworks/events). No
# @wizeworks/db, no Prisma client — the console holds no tenant business-data DB
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
# Root `patchedDependencies` is hashed before resolution, so the patch files are
# needed even when this filter excludes the package they patch.
COPY patches ./patches
COPY wizeworks/apps/admin/package.json wizeworks/apps/admin/
COPY wizeworks/packages/ui/package.json wizeworks/packages/ui/
COPY wizeworks/packages/forms/package.json wizeworks/packages/forms/
COPY wizeworks/packages/brand/package.json wizeworks/packages/brand/
COPY wizeworks/packages/silica-corrections/package.json wizeworks/packages/silica-corrections/
COPY wizeworks/packages/operator/package.json wizeworks/packages/operator/
COPY wizeworks/packages/operator-auth/package.json wizeworks/packages/operator-auth/
COPY wizeworks/packages/events/package.json wizeworks/packages/events/

# Install only the @wizeworks/admin subgraph (its deps + transitive workspace deps).
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @wizeworks/admin...

# Source for every workspace dep + the app itself.
COPY wizeworks/packages/ui wizeworks/packages/ui
COPY wizeworks/packages/forms wizeworks/packages/forms
COPY wizeworks/packages/brand wizeworks/packages/brand
COPY wizeworks/packages/silica-corrections wizeworks/packages/silica-corrections
COPY wizeworks/packages/operator wizeworks/packages/operator
COPY wizeworks/packages/operator-auth wizeworks/packages/operator-auth
COPY wizeworks/packages/events wizeworks/packages/events
COPY wizeworks/apps/admin wizeworks/apps/admin

# Stamp the release version into the client bundle (NEXT_PUBLIC_* is inlined at
# build time). Declared right before the build so a version bump never busts the
# cached dependency/source layers above it.
ARG APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION

RUN pnpm --filter @wizeworks/admin build

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

COPY --from=builder --chown=nextjs:nodejs /repo/wizeworks/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/wizeworks/apps/admin/.next/static ./wizeworks/apps/admin/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "wizeworks/apps/admin/server.js"]
