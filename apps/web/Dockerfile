# syntax=docker/dockerfile:1.7
#
# Multi-stage Next.js build for the @sparx/web marketing site.
# Produces a minimal standalone bundle (~150MB) on Node 24 alpine.
#
# Built from the repo root context (per .github/workflows/build-images.yml):
#   docker build -f apps/web/Dockerfile -t sparx/web:tag .

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# ----- Install + build -----
FROM base AS builder

# Workspace metadata first — maximises layer cache reuse across source changes.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/ui/package.json packages/ui/
COPY packages/brand/package.json packages/brand/
# @sparx/forms — client form-validation engine behind silica's FieldStatus (react peer only).
COPY packages/forms/package.json packages/forms/
COPY packages/web-chrome/package.json packages/web-chrome/
COPY packages/legal/package.json packages/legal/
COPY packages/attribution/package.json packages/attribution/
COPY packages/chat-widget/package.json packages/chat-widget/
COPY packages/site-themes/package.json packages/site-themes/

# Install only the @sparx/web subgraph (its deps + transitive workspace deps).
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @sparx/web...

COPY packages/ui packages/ui
COPY packages/brand packages/brand
COPY packages/forms packages/forms
COPY packages/web-chrome packages/web-chrome
COPY packages/legal packages/legal
COPY packages/attribution packages/attribution
COPY packages/chat-widget packages/chat-widget
COPY packages/site-themes packages/site-themes
COPY apps/web apps/web

# PostHog analytics — NEXT_PUBLIC_* is inlined at build time, so the key must be
# present during `next build`; runtime env can't reach an already-bundled client
# JS. Passed as a build-arg from build-images.yml. Absent ⇒ the provider no-ops
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
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
# public/ is NOT bundled into standalone output — copy it explicitly so the
# manifest icons (android-chrome-*.png) and schema logo (icon.png) serve.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
