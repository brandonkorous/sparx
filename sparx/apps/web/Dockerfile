# syntax=docker/dockerfile:1.7
#
# Multi-stage Next.js build for the @sparx/web marketing site.
# Produces a minimal standalone bundle (~150MB) on Node 24 alpine.
#
# Built from the repo root context (per .github/workflows/build-images-gcp.yml):
#   docker build -f sparx/apps/web/Dockerfile -t sparx/web:tag .

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# ----- Install + build -----
FROM base AS builder

# Workspace metadata first — maximises layer cache reuse across source changes.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
# Root `patchedDependencies` is hashed before resolution, so the patch files are
# needed even when this filter excludes the package they patch.
COPY patches ./patches
COPY sparx/apps/web/package.json sparx/apps/web/
COPY wizeworks/packages/app-kit/package.json wizeworks/packages/app-kit/
COPY wizeworks/packages/ui/package.json wizeworks/packages/ui/
COPY sparx/packages/brand/package.json sparx/packages/brand/
# @wizeworks/forms — client form-validation engine behind silica's FieldStatus (react peer only).
COPY wizeworks/packages/forms/package.json wizeworks/packages/forms/
COPY wizeworks/packages/legal/package.json wizeworks/packages/legal/
COPY wizeworks/packages/attribution/package.json wizeworks/packages/attribution/
COPY wizeworks/packages/chat-widget/package.json wizeworks/packages/chat-widget/
COPY wizeworks/packages/site-themes/package.json wizeworks/packages/site-themes/
COPY wizeworks/packages/story-schemas/package.json wizeworks/packages/story-schemas/
# The vendor registry behind /migrate — the hub, each per-vendor page and the OG
# route all read it at render time, so it is a boot-time dep, not a build aid.
COPY wizeworks/packages/migration/package.json wizeworks/packages/migration/
# The market's component previews render real catalog nodes — globals.css also
# @imports/@sources silica-catalog by relative path, so BOTH must be present.
COPY wizeworks/packages/builder-schemas/package.json wizeworks/packages/builder-schemas/
COPY wizeworks/packages/silica-catalog/package.json wizeworks/packages/silica-catalog/
COPY wizeworks/packages/silica-corrections/package.json wizeworks/packages/silica-corrections/

# Install only the @sparx/web subgraph (its deps + transitive workspace deps).
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @sparx/web...

COPY wizeworks/packages/app-kit wizeworks/packages/app-kit
COPY wizeworks/packages/ui wizeworks/packages/ui
COPY sparx/packages/brand sparx/packages/brand
COPY wizeworks/packages/forms wizeworks/packages/forms
COPY wizeworks/packages/legal wizeworks/packages/legal
COPY wizeworks/packages/attribution wizeworks/packages/attribution
COPY wizeworks/packages/chat-widget wizeworks/packages/chat-widget
COPY wizeworks/packages/site-themes wizeworks/packages/site-themes
COPY wizeworks/packages/story-schemas wizeworks/packages/story-schemas
COPY wizeworks/packages/migration wizeworks/packages/migration
COPY wizeworks/packages/builder-schemas wizeworks/packages/builder-schemas
COPY wizeworks/packages/silica-catalog wizeworks/packages/silica-catalog
COPY wizeworks/packages/silica-corrections wizeworks/packages/silica-corrections
COPY sparx/apps/web sparx/apps/web

# PostHog analytics — NEXT_PUBLIC_* is inlined at build time, so the key must be
# present during `next build`; runtime env can't reach an already-bundled client
# JS. Passed as a build-arg from build-images-gcp.yml. Absent ⇒ the provider no-ops
# (`if (!key) return`), so a build without the arg simply ships PostHog disabled.
# HOST carries the canonical default so a plain `docker build` needs no arg.
ARG NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST

# next.config.ts must have `output: 'standalone'` and outputFileTracingRoot
# pointing at the monorepo root for this to work.
RUN pnpm --filter @sparx/web build

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
COPY --from=builder --chown=nextjs:nodejs /repo/sparx/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/sparx/apps/web/.next/static ./sparx/apps/web/.next/static
# public/ is NOT bundled into standalone output — copy it explicitly so the
# manifest icons (android-chrome-*.png) and schema logo (icon.png) serve.
COPY --from=builder --chown=nextjs:nodejs /repo/sparx/apps/web/public ./sparx/apps/web/public

USER nextjs

EXPOSE 3000

CMD ["node", "sparx/apps/web/server.js"]
