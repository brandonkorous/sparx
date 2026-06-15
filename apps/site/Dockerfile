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
COPY packages/ui/package.json packages/ui/
COPY packages/cms-editor/package.json packages/cms-editor/
COPY packages/site-themes/package.json packages/site-themes/
COPY packages/site-ui/package.json packages/site-ui/
COPY packages/sitebuilder-schemas/package.json packages/sitebuilder-schemas/
COPY packages/section-template-react/package.json packages/section-template-react/
COPY packages/builder-schemas/package.json packages/builder-schemas/
# @sparx/builder-render — the shared canvas↔live render path (docs/builder/02); the
# live storefront renders through it. Its workspace deps (builder-schemas, cms-editor,
# site-ui) are above.
COPY packages/builder-render/package.json packages/builder-render/
COPY packages/chat-widget/package.json packages/chat-widget/

# Install only the @sparx/site subgraph (its deps + transitive workspace deps).
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @sparx/site...

COPY packages/ui packages/ui
COPY packages/cms-editor packages/cms-editor
COPY packages/site-themes packages/site-themes
COPY packages/site-ui packages/site-ui
COPY packages/sitebuilder-schemas packages/sitebuilder-schemas
COPY packages/section-template-react packages/section-template-react
COPY packages/builder-schemas packages/builder-schemas
COPY packages/builder-render packages/builder-render
COPY packages/chat-widget packages/chat-widget
COPY apps/site apps/site

# @sparx/site-ui ships its stylesheet as a BUILD artifact (dist/styles.css, Tailwind
# @apply → plain CSS); dist is gitignored, so the fresh CI checkout lacks it. Build
# it before the app so `import '@sparx/site-ui/styles.css'` resolves. tailwind CLI is
# an installed devDep of site-ui (the filtered install above is not --prod).
RUN pnpm --filter @sparx/site-ui build

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
