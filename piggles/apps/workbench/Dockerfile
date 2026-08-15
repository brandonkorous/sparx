# syntax=docker/dockerfile:1.7
#
# @piggles/console — mypiggles.com, the operating console. Standalone Next.js on
# Node 24 alpine, built from the repo ROOT context:
#
#   docker build -f piggles/apps/workbench/Dockerfile -t piggles/console:tag .
#
# ── WHY THIS IS NOT apps/workbench/Dockerfile WITH A PATH CHANGED ────────────
#
# It looks nearly identical to sparx's and it is a separate file on purpose.
# piggles/CLAUDE.md RULE #0: either product must be deletable tomorrow without
# affecting the other, and a shared Dockerfile is a shared build — deleting
# apps/workbench would delete this image's recipe.
#
# The two lists are also already different (this one carries the four
# `@piggles/*` packages and sparx's does not) and they will drift further as
# each product's surfaces change. Nothing keeps them honest by eye:
# scripts/check-dockerfile-deps.mjs verifies EACH file against its OWN app's
# declared closure, which is why adding a workspace dependency here without
# re-running it is the one way to break this image.
#
# The image name is `piggles-console`, not `piggles-workbench`: the directory is
# `apps/workbench` because the console is a workbench-shaped app, but nothing a
# person or an ops runbook sees should use a word this product does not have
# (RULE #3 — the lexicon calls it the console, and the package is
# `@piggles/console`).

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# ----- Install + build -----
FROM base AS builder

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
# Hashed before resolution — needed whatever the filter excludes. The console is
# the app that actually consumes it: silicaui-react sits on Base UI.
COPY patches ./patches
COPY piggles/apps/workbench/package.json piggles/apps/workbench/

# Piggles' own.
COPY piggles/packages/auth-handoff/package.json piggles/packages/auth-handoff/
COPY piggles/packages/brand/package.json piggles/packages/brand/
COPY piggles/packages/config/package.json piggles/packages/config/
COPY piggles/packages/mascot/package.json piggles/packages/mascot/

# The platform libraries the ~450 forked surfaces sit on. These are LIBRARIES
# under packages/ — depending on one couples nothing, because deleting sparx's
# apps does not delete them (piggles/CLAUDE.md, "The guard").
COPY packages/api-client/package.json packages/api-client/
COPY packages/api-core/package.json packages/api-core/
COPY packages/app-kit/package.json packages/app-kit/
COPY packages/attribution/package.json packages/attribution/
COPY packages/auth/package.json packages/auth/
COPY packages/automation-schemas/package.json packages/automation-schemas/
COPY packages/blueprints/package.json packages/blueprints/
COPY packages/brand/package.json packages/brand/
COPY packages/builder-schemas/package.json packages/builder-schemas/
COPY packages/cms-editor/package.json packages/cms-editor/
COPY packages/cms-schemas/package.json packages/cms-schemas/
COPY packages/commerce-schemas/package.json packages/commerce-schemas/
COPY packages/crm-schemas/package.json packages/crm-schemas/
COPY packages/db/package.json packages/db/
COPY packages/email/package.json packages/email/
COPY packages/email-sends/package.json packages/email-sends/
COPY packages/email-sequences/package.json packages/email-sequences/
COPY packages/events/package.json packages/events/
COPY packages/field-schema/package.json packages/field-schema/
COPY packages/integrations/package.json packages/integrations/
COPY packages/legal/package.json packages/legal/
COPY packages/legal-seed/package.json packages/legal-seed/
COPY packages/legal-templates/package.json packages/legal-templates/
# The address table. Pure data — but the catch-all route resolves paths through
# it during the SERVER render, so a missing copy fails at boot, not lazily.
COPY packages/links/package.json packages/links/
COPY packages/marketplace-schemas/package.json packages/marketplace-schemas/
COPY packages/migration/package.json packages/migration/
COPY packages/modules/package.json packages/modules/
COPY packages/query/package.json packages/query/
COPY packages/silica-catalog/package.json packages/silica-catalog/
COPY packages/site-themes/package.json packages/site-themes/
COPY packages/sitebuilder-schemas/package.json packages/sitebuilder-schemas/
COPY packages/social/package.json packages/social/
COPY packages/story-schemas/package.json packages/story-schemas/
COPY packages/ui/package.json packages/ui/

# Root postinstall runs `pnpm --filter @sparx/db db:generate`.
COPY packages/db/prisma packages/db/prisma
COPY packages/db/prisma.config.ts packages/db/prisma.config.ts

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @piggles/console...

# Source for every workspace dep + the app itself.
COPY piggles/packages/auth-handoff piggles/packages/auth-handoff
COPY piggles/packages/brand piggles/packages/brand
COPY piggles/packages/config piggles/packages/config
COPY piggles/packages/mascot piggles/packages/mascot
COPY packages/api-client packages/api-client
COPY packages/api-core packages/api-core
COPY packages/app-kit packages/app-kit
COPY packages/attribution packages/attribution
COPY packages/auth packages/auth
COPY packages/automation-schemas packages/automation-schemas
COPY packages/blueprints packages/blueprints
COPY packages/brand packages/brand
COPY packages/builder-schemas packages/builder-schemas
COPY packages/cms-editor packages/cms-editor
COPY packages/cms-schemas packages/cms-schemas
COPY packages/commerce-schemas packages/commerce-schemas
COPY packages/crm-schemas packages/crm-schemas
COPY packages/db packages/db
COPY packages/email packages/email
COPY packages/email-sends packages/email-sends
COPY packages/email-sequences packages/email-sequences
COPY packages/events packages/events
COPY packages/field-schema packages/field-schema
COPY packages/integrations packages/integrations
COPY packages/legal packages/legal
COPY packages/legal-seed packages/legal-seed
COPY packages/legal-templates packages/legal-templates
COPY packages/links packages/links
COPY packages/marketplace-schemas packages/marketplace-schemas
COPY packages/migration packages/migration
COPY packages/modules packages/modules
COPY packages/query packages/query
COPY packages/silica-catalog packages/silica-catalog
COPY packages/site-themes packages/site-themes
COPY packages/sitebuilder-schemas packages/sitebuilder-schemas
COPY packages/social packages/social
COPY packages/story-schemas packages/story-schemas
COPY packages/ui packages/ui
COPY piggles/apps/workbench piggles/apps/workbench

RUN pnpm --filter @sparx/db db:generate

ARG APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION

ARG NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST

# NODE_OPTIONS on the RUN line, NOT an ENV — the runner stage is a separate FROM
# and sets its own cap to match the pod's memory limit, which must never be
# shadowed by a build-time value.
#
# The console carries the SAME surface layer sparx's workbench does (it is a fork
# of it, by RULE #0), so it hits the same wall: `next build` type-checks the whole
# thing and the program no longer fits V8's default ~4 GB. It does not fail as a
# type error — the worker dies with `Ineffective mark-compacts near heap limit`
# and SIGABRT, which reads as a broken build rather than a box that ran short.
RUN NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter @piggles/console build

# ----- Production runner -----
FROM node:${NODE_VERSION} AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Same value as the client bundle, exposed at runtime so /api/version can report
# what this pod serves. During a rolling deploy an old tab (built from A) polls a
# new pod (serving B) → mismatch → the reload prompt.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/piggles/apps/workbench/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/piggles/apps/workbench/.next/static ./piggles/apps/workbench/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/piggles/apps/workbench/public ./piggles/apps/workbench/public

USER nextjs

EXPOSE 3000

CMD ["node", "piggles/apps/workbench/server.js"]
