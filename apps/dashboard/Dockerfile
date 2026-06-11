# syntax=docker/dockerfile:1.7
#
# Multi-stage Next.js build for @sparx/dashboard.
# Produces a standalone bundle on Node 24 alpine.
#
# Built from the repo root context (per .github/workflows/build-images.yml):
#   docker build -f apps/dashboard/Dockerfile -t sparx/dashboard:tag .

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# ----- Install + build -----
FROM base AS builder

# Workspace metadata first — maximises layer cache reuse across source changes.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/ui/package.json packages/ui/
COPY packages/auth/package.json packages/auth/
COPY packages/modules/package.json packages/modules/
COPY packages/legal/package.json packages/legal/
COPY packages/db/package.json packages/db/
COPY packages/email/package.json packages/email/
COPY packages/events/package.json packages/events/
COPY packages/crm/package.json packages/crm/
COPY packages/crm-schemas/package.json packages/crm-schemas/
COPY packages/commerce/package.json packages/commerce/
COPY packages/commerce-schemas/package.json packages/commerce-schemas/
COPY packages/integration-framework/package.json packages/integration-framework/
COPY packages/provider-avalara/package.json packages/provider-avalara/
COPY packages/provider-easypost/package.json packages/provider-easypost/
COPY packages/provider-paypal/package.json packages/provider-paypal/
COPY packages/provider-shippo/package.json packages/provider-shippo/
COPY packages/provider-stripe/package.json packages/provider-stripe/
COPY packages/provider-taxjar/package.json packages/provider-taxjar/
COPY packages/search/package.json packages/search/
COPY packages/seo-audit/package.json packages/seo-audit/
COPY packages/cms-editor/package.json packages/cms-editor/
COPY packages/cms-schemas/package.json packages/cms-schemas/
COPY packages/email-platform/package.json packages/email-platform/
COPY packages/site-themes/package.json packages/site-themes/
COPY packages/site-ui/package.json packages/site-ui/
COPY packages/sitebuilder/package.json packages/sitebuilder/
COPY packages/sitebuilder-schemas/package.json packages/sitebuilder-schemas/
COPY packages/section-template-react/package.json packages/section-template-react/
COPY packages/builder-schemas/package.json packages/builder-schemas/
COPY packages/attribution/package.json packages/attribution/
# Root postinstall runs `pnpm --filter @sparx/db db:generate`, which needs
# both the schema source AND the prisma config file (the new multi-file
# schema lives in prisma/schema/, declared in prisma.config.ts).
COPY packages/db/prisma packages/db/prisma
COPY packages/db/prisma.config.ts packages/db/prisma.config.ts

# Install only the @sparx/dashboard subgraph (its deps + transitive workspace deps).
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @sparx/dashboard...

# Source for every workspace dep + the app itself.
COPY packages/ui packages/ui
COPY packages/auth packages/auth
COPY packages/modules packages/modules
COPY packages/legal packages/legal
COPY packages/db packages/db
COPY packages/email packages/email
COPY packages/events packages/events
COPY packages/crm packages/crm
COPY packages/crm-schemas packages/crm-schemas
COPY packages/commerce packages/commerce
COPY packages/commerce-schemas packages/commerce-schemas
COPY packages/integration-framework packages/integration-framework
COPY packages/provider-avalara packages/provider-avalara
COPY packages/provider-easypost packages/provider-easypost
COPY packages/provider-paypal packages/provider-paypal
COPY packages/provider-shippo packages/provider-shippo
COPY packages/provider-stripe packages/provider-stripe
COPY packages/provider-taxjar packages/provider-taxjar
COPY packages/search packages/search
COPY packages/seo-audit packages/seo-audit
COPY packages/cms-editor packages/cms-editor
COPY packages/cms-schemas packages/cms-schemas
COPY packages/email-platform packages/email-platform
COPY packages/site-themes packages/site-themes
COPY packages/site-ui packages/site-ui
COPY packages/sitebuilder packages/sitebuilder
COPY packages/sitebuilder-schemas packages/sitebuilder-schemas
COPY packages/section-template-react packages/section-template-react
COPY packages/builder-schemas packages/builder-schemas
COPY packages/attribution packages/attribution
COPY apps/dashboard apps/dashboard

# Generate Prisma client (the dashboard imports @sparx/db which re-exports it).
RUN pnpm --filter @sparx/db db:generate

# @sparx/site-ui ships its stylesheets as BUILD artifacts (dist/styles.css +
# dist/styles.canvas.css, Tailwind @apply → plain CSS); dist is gitignored, so a
# fresh CI checkout lacks it. Build it before the app so the Builder canvas's
# `import '@sparx/site-ui/styles.canvas.css'` resolves. tailwind CLI is an
# installed devDep of site-ui (the filtered install above is not --prod).
RUN pnpm --filter @sparx/site-ui build

RUN pnpm --filter @sparx/dashboard build

# ----- Production runner -----
FROM node:${NODE_VERSION} AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/dashboard/.next/static ./apps/dashboard/.next/static
# public/ is NOT bundled into standalone output — copy it explicitly so the
# manifest icons (android-chrome-*.png) serve.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/dashboard/public ./apps/dashboard/public

USER nextjs

EXPOSE 3000

CMD ["node", "apps/dashboard/server.js"]
