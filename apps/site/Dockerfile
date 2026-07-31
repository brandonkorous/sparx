# syntax=docker/dockerfile:1.7
#
# Multi-stage Next.js build for the @sparx/site tenant storefront.
# Mirrors apps/web/Dockerfile — same standalone output shape.
#
# Built from the repo root context (per .github/workflows/build-images.yml):
#   docker build -f apps/site/Dockerfile -t sparx/storefront:tag .

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# ----- Install + build -----
FROM base AS builder

# Workspace metadata first — maximises layer cache reuse across source changes.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/site/package.json apps/site/
COPY packages/app-kit/package.json packages/app-kit/
# @sparx/brand — the single home for the spark/wordmark/mascot geometry + BRAND
# constants. @sparx/ui re-exports from it, so every app that pulls in ui needs it.
COPY packages/brand/package.json packages/brand/
COPY packages/ui/package.json packages/ui/
COPY packages/cms-editor/package.json packages/cms-editor/
COPY packages/site-themes/package.json packages/site-themes/
COPY packages/sitebuilder-schemas/package.json packages/sitebuilder-schemas/
COPY packages/section-template-react/package.json packages/section-template-react/
COPY packages/builder-schemas/package.json packages/builder-schemas/
# @sparx/silica-catalog — the silica-native domain catalog the storefront renders
# published silica pages through (docs/118). Only npm dep is silicaui-html; no
# workspace deps of its own.
COPY packages/silica-catalog/package.json packages/silica-catalog/
# @sparx/builder-render — the shared canvas↔live render path (docs/builder/02); the
# live storefront renders through it. Its workspace deps (builder-schemas,
# cms-editor) are above.
COPY packages/builder-render/package.json packages/builder-render/
COPY packages/chat-widget/package.json packages/chat-widget/

# Install only the @sparx/site subgraph (its deps + transitive workspace deps).
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @sparx/site...

COPY packages/app-kit packages/app-kit
COPY packages/brand packages/brand
COPY packages/ui packages/ui
COPY packages/cms-editor packages/cms-editor
COPY packages/site-themes packages/site-themes
COPY packages/sitebuilder-schemas packages/sitebuilder-schemas
COPY packages/section-template-react packages/section-template-react
COPY packages/builder-schemas packages/builder-schemas
COPY packages/silica-catalog packages/silica-catalog
COPY packages/builder-render packages/builder-render
COPY packages/chat-widget packages/chat-widget
COPY apps/site apps/site

# Stripe.js publishable key. `NEXT_PUBLIC_*` is INLINED INTO THE CLIENT BUNDLE AT
# BUILD TIME — setting it on the running pod does nothing, so it has to arrive as a
# build-arg here (wired from the repo variable in build-images.yml). Without it the
# checkout's Payment Element never mounts and every tenant storefront shows
# "Payments aren't configured for this store yet". This is the PLATFORM key: sparx
# Pay's intents are destination charges on sparx's own account, so the platform key
# is the right one to confirm them with. A `stripe_direct` tenant's intent lives on
# THEIR account and is confirmed with THEIR publishable key, which the payment-intent
# response carries per-request (see packages/payments/src/gateways/stripe-direct.ts).
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

# Public API base URL — same build-time inlining rule as the Stripe key above. The
# CLIENT components (cart, mini-cart, order summary — all 'use client') build storefront
# media URLs via lib/media's `mediaUrl`, which reads NEXT_PUBLIC_API_URL. Without it in
# the bundle, mediaUrl falls back to http://localhost:3100, so on an HTTPS storefront the
# browser blocks the image as mixed content AND raises a Chrome Private-Network-Access
# permission prompt on add-to-cart (the mini-cart image is a local-network request).
# Server components read SPARX_API_REST_URL at runtime and are unaffected.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# next.config.mjs has `output: 'standalone'` and outputFileTracingRoot
# pointing at the monorepo root for this to work.
RUN pnpm --filter @sparx/site build

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
COPY --from=builder --chown=nextjs:nodejs /repo/apps/site/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/site/.next/static ./apps/site/.next/static
# public/ is NOT bundled into standalone output — copy it explicitly so the
# default favicon fallback (favicon.ico, sparx-icon.svg) serves.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/site/public ./apps/site/public

# Next's incremental data cache lives at <distDir>/cache (apps/site/.next/cache).
# The standalone output ships .next/{standalone,static} but NOT a cache dir, so
# at runtime the dir is absent — Next can't read/write the fetch Data Cache, which
# silently degrades `next: { revalidate }` fetches. Create it writable up front.
RUN mkdir -p ./apps/site/.next/cache \
 && chown -R nextjs:nodejs ./apps/site/.next

USER nextjs

EXPOSE 3000

CMD ["node", "apps/site/server.js"]
