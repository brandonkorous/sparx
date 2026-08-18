# syntax=docker/dockerfile:1.7
#
# @piggles/console — mypiggles.com, the operating console. Standalone Next.js on
# Node 24 alpine, built from the repo ROOT context:
#
#   docker build -f piggles/apps/workbench/Dockerfile -t piggles/console:tag .
#
# ── WHY THIS IS NOT sparx/apps/workbench/Dockerfile WITH A PATH CHANGED ────────────
#
# It looks nearly identical to sparx's and it is a separate file on purpose.
# piggles/CLAUDE.md RULE #0: either product must be deletable tomorrow without
# affecting the other, and a shared Dockerfile is a shared build — deleting
# sparx/apps/workbench would delete this image's recipe.
#
# The two lists are also already different (this one carries the four
# `@piggles/*` packages and sparx's does not) and they will drift further as
# each product's surfaces change. Nothing keeps them honest by eye:
# scripts/check-dockerfile-deps.mjs verifies EACH file against its OWN app's
# declared closure, which is why adding a workspace dependency here without
# re-running it is the one way to break this image.
#
# The image name is `piggles-console`, not `piggles-workbench`: the directory is
# `sparx/apps/workbench` because the console is a workbench-shaped app, but nothing a
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

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json .npmrc ./
COPY piggles/apps/workbench/package.json piggles/apps/workbench/

# Piggles' own.
COPY piggles/packages/auth-handoff/package.json piggles/packages/auth-handoff/
COPY piggles/packages/brand/package.json piggles/packages/brand/
COPY piggles/packages/config/package.json piggles/packages/config/
COPY piggles/packages/mascot/package.json piggles/packages/mascot/
COPY piggles/packages/ui/package.json piggles/packages/ui/

# The platform libraries the ~450 forked surfaces sit on. Brand-blind by policy:
# none of them may state a sparx value, and the scope rename to @wizeworks/*
# (piggles/docs/migration, phase A3) is what will make that legible in the name.
#
# NEITHER `sparx/packages/brand` NOR `sparx/packages/ui` IS IN THIS LIST ANY MORE, and that
# took two edits rather than one. Dropping them as direct dependencies was easy —
# the console imported neither. The image still pulled them in regardless, via:
#
#     @piggles/console → @wizeworks/cms-editor → @wizeworks/ui → @sparx/brand
#
# So sparx's actual brand package was inside the Piggles image by way of the CMS
# editor, and "nothing renders from it" is not the test the migration has to
# pass. The chain turned out to be held up by exactly two things: `cn`, a
# 26-line tailwind-merge wrapper with no brand in it, and a type from a module
# manifest written for the removed dashboard that nothing consumed. `cn` moved to
# @wizeworks/silica-corrections (re-exported from @wizeworks/ui, so admin was
# untouched) and the four dead manifests were deleted. Broken 2026-08-16.
#
# If either package reappears below, something re-coupled — find the new edge
# rather than adding the COPY line back.
COPY wizeworks/packages/api-client/package.json wizeworks/packages/api-client/
COPY wizeworks/packages/api-core/package.json wizeworks/packages/api-core/
COPY wizeworks/packages/app-kit/package.json wizeworks/packages/app-kit/
COPY wizeworks/packages/attribution/package.json wizeworks/packages/attribution/
COPY wizeworks/packages/auth/package.json wizeworks/packages/auth/
COPY wizeworks/packages/brand-core/package.json wizeworks/packages/brand-core/
COPY wizeworks/packages/automation-schemas/package.json wizeworks/packages/automation-schemas/
COPY wizeworks/packages/blueprints/package.json wizeworks/packages/blueprints/
COPY wizeworks/packages/builder-schemas/package.json wizeworks/packages/builder-schemas/
COPY wizeworks/packages/cms-editor/package.json wizeworks/packages/cms-editor/
COPY wizeworks/packages/cms-schemas/package.json wizeworks/packages/cms-schemas/
COPY wizeworks/packages/commerce-schemas/package.json wizeworks/packages/commerce-schemas/
COPY wizeworks/packages/crm-schemas/package.json wizeworks/packages/crm-schemas/
COPY wizeworks/packages/db/package.json wizeworks/packages/db/
COPY wizeworks/packages/email/package.json wizeworks/packages/email/
COPY wizeworks/packages/email-sends/package.json wizeworks/packages/email-sends/
COPY wizeworks/packages/email-sequences/package.json wizeworks/packages/email-sequences/
COPY wizeworks/packages/events/package.json wizeworks/packages/events/
COPY wizeworks/packages/field-schema/package.json wizeworks/packages/field-schema/
COPY wizeworks/packages/integrations/package.json wizeworks/packages/integrations/
COPY wizeworks/packages/legal/package.json wizeworks/packages/legal/
COPY wizeworks/packages/legal-seed/package.json wizeworks/packages/legal-seed/
COPY wizeworks/packages/legal-templates/package.json wizeworks/packages/legal-templates/
# The address table. Pure data — but the catch-all route resolves paths through
# it during the SERVER render, so a missing copy fails at boot, not lazily.
COPY wizeworks/packages/links/package.json wizeworks/packages/links/
COPY wizeworks/packages/marketplace-schemas/package.json wizeworks/packages/marketplace-schemas/
COPY wizeworks/packages/migration/package.json wizeworks/packages/migration/
COPY wizeworks/packages/modules/package.json wizeworks/packages/modules/
COPY wizeworks/packages/query/package.json wizeworks/packages/query/
COPY wizeworks/packages/silica-catalog/package.json wizeworks/packages/silica-catalog/
COPY wizeworks/packages/silica-corrections/package.json wizeworks/packages/silica-corrections/
COPY wizeworks/packages/site-themes/package.json wizeworks/packages/site-themes/
COPY wizeworks/packages/studio/package.json wizeworks/packages/studio/
COPY wizeworks/packages/sitebuilder-schemas/package.json wizeworks/packages/sitebuilder-schemas/
COPY wizeworks/packages/social/package.json wizeworks/packages/social/
COPY wizeworks/packages/story-schemas/package.json wizeworks/packages/story-schemas/

# Root postinstall runs `pnpm --filter @wizeworks/db db:generate`.
COPY wizeworks/packages/db/prisma wizeworks/packages/db/prisma
COPY wizeworks/packages/db/prisma.config.ts wizeworks/packages/db/prisma.config.ts

# The Font Awesome Pro token reaches pnpm as an env var for one command, read
# from a BuildKit secret mount. It is never COPYed and never lands in a layer.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    --mount=type=secret,id=fontawesome_npm_token \
    FONTAWESOME_NPM_TOKEN="$(cat /run/secrets/fontawesome_npm_token 2>/dev/null || true)" \
    pnpm install --frozen-lockfile --filter @piggles/console...

# Source for every workspace dep + the app itself.
COPY piggles/packages/auth-handoff piggles/packages/auth-handoff
COPY piggles/packages/brand piggles/packages/brand
COPY piggles/packages/config piggles/packages/config
COPY piggles/packages/mascot piggles/packages/mascot
COPY piggles/packages/ui piggles/packages/ui
COPY wizeworks/packages/api-client wizeworks/packages/api-client
COPY wizeworks/packages/api-core wizeworks/packages/api-core
COPY wizeworks/packages/app-kit wizeworks/packages/app-kit
COPY wizeworks/packages/attribution wizeworks/packages/attribution
COPY wizeworks/packages/auth wizeworks/packages/auth
COPY wizeworks/packages/brand-core wizeworks/packages/brand-core
COPY wizeworks/packages/automation-schemas wizeworks/packages/automation-schemas
COPY wizeworks/packages/blueprints wizeworks/packages/blueprints
COPY wizeworks/packages/builder-schemas wizeworks/packages/builder-schemas
COPY wizeworks/packages/cms-editor wizeworks/packages/cms-editor
COPY wizeworks/packages/cms-schemas wizeworks/packages/cms-schemas
COPY wizeworks/packages/commerce-schemas wizeworks/packages/commerce-schemas
COPY wizeworks/packages/crm-schemas wizeworks/packages/crm-schemas
COPY wizeworks/packages/db wizeworks/packages/db
COPY wizeworks/packages/email wizeworks/packages/email
COPY wizeworks/packages/email-sends wizeworks/packages/email-sends
COPY wizeworks/packages/email-sequences wizeworks/packages/email-sequences
COPY wizeworks/packages/events wizeworks/packages/events
COPY wizeworks/packages/field-schema wizeworks/packages/field-schema
COPY wizeworks/packages/integrations wizeworks/packages/integrations
COPY wizeworks/packages/legal wizeworks/packages/legal
COPY wizeworks/packages/legal-seed wizeworks/packages/legal-seed
COPY wizeworks/packages/legal-templates wizeworks/packages/legal-templates
COPY wizeworks/packages/links wizeworks/packages/links
COPY wizeworks/packages/marketplace-schemas wizeworks/packages/marketplace-schemas
COPY wizeworks/packages/migration wizeworks/packages/migration
COPY wizeworks/packages/modules wizeworks/packages/modules
COPY wizeworks/packages/query wizeworks/packages/query
COPY wizeworks/packages/silica-catalog wizeworks/packages/silica-catalog
COPY wizeworks/packages/silica-corrections wizeworks/packages/silica-corrections
COPY wizeworks/packages/site-themes wizeworks/packages/site-themes
COPY wizeworks/packages/studio wizeworks/packages/studio
COPY wizeworks/packages/sitebuilder-schemas wizeworks/packages/sitebuilder-schemas
COPY wizeworks/packages/social wizeworks/packages/social
COPY wizeworks/packages/story-schemas wizeworks/packages/story-schemas
COPY piggles/apps/workbench piggles/apps/workbench

RUN pnpm --filter @wizeworks/db db:generate

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
