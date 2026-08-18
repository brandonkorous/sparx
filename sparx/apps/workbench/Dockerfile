# syntax=docker/dockerfile:1.7
#
# Multi-stage Next.js build for @sparx/workbench — the multi-window workbench
# at workbench.sparx.works. Produces a standalone bundle on Node 24 alpine.
#
# Built from the repo root context (per .github/workflows/build-images-gcp.yml):
#   docker build -f sparx/apps/workbench/Dockerfile -t sparx/workbench:tag .

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# ----- Install + build -----
FROM base AS builder

# Workspace metadata first — maximises layer cache reuse across source changes.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
# Root `patchedDependencies` is hashed before resolution, so the patch files are
# needed even when this filter excludes the package they patch. The workbench is
# the one app that actually consumes it — silicaui-react sits on Base UI.
COPY patches ./patches
COPY sparx/apps/workbench/package.json sparx/apps/workbench/
# The workbench's direct workspace deps are deliberately few — it is a browser-
# rendered app whose only server surface is Better Auth + the /api/token BFF:
COPY wizeworks/packages/app-kit/package.json wizeworks/packages/app-kit/
COPY wizeworks/packages/api-client/package.json wizeworks/packages/api-client/
COPY wizeworks/packages/auth/package.json wizeworks/packages/auth/
COPY wizeworks/packages/brand-core/package.json wizeworks/packages/brand-core/
COPY sparx/packages/brand/package.json sparx/packages/brand/
# The address table. Pure data, no dependencies of its own — but the catch-all
# route resolves paths through it during the SERVER render, so a missing copy is
# a boot-time failure, not a lazily-discovered one.
COPY wizeworks/packages/links/package.json wizeworks/packages/links/
# The move-in vendor registry. Read by the migration surfaces during the SERVER
# render, same as the address table above — a missing copy fails at boot.
COPY wizeworks/packages/migration/package.json wizeworks/packages/migration/
COPY wizeworks/packages/query/package.json wizeworks/packages/query/
# …and @wizeworks/auth's transitive closure. Its index re-exports server.ts →
# tenant-events.ts, which pulls legal seeding; @wizeworks/email (a direct auth dep)
# pulls the template packages. Every member must be present or the filtered
# install leaves a dangling symlink that the build fails to resolve.
COPY wizeworks/packages/attribution/package.json wizeworks/packages/attribution/
COPY wizeworks/packages/db/package.json wizeworks/packages/db/
COPY wizeworks/packages/email/package.json wizeworks/packages/email/
COPY wizeworks/packages/events/package.json wizeworks/packages/events/
COPY wizeworks/packages/legal/package.json wizeworks/packages/legal/
COPY wizeworks/packages/legal-seed/package.json wizeworks/packages/legal-seed/
COPY wizeworks/packages/legal-templates/package.json wizeworks/packages/legal-templates/
COPY wizeworks/packages/modules/package.json wizeworks/packages/modules/
COPY wizeworks/packages/builder-schemas/package.json wizeworks/packages/builder-schemas/
COPY wizeworks/packages/cms-editor/package.json wizeworks/packages/cms-editor/
COPY wizeworks/packages/ui/package.json wizeworks/packages/ui/
# The surface layer's schema + catalog deps and their transitive @sparx closure.
# The workbench is no longer "deliberately few" deps — its ~66 surfaces import
# the commerce/crm/automation/story/marketplace/cms/sitebuilder schemas, the
# silica catalog, site themes, and blueprints directly. Every member must be
# present or the filtered install leaves a dangling symlink the build can't
# resolve (the Module-not-found class of failure).
COPY wizeworks/packages/automation-schemas/package.json wizeworks/packages/automation-schemas/
COPY wizeworks/packages/blueprints/package.json wizeworks/packages/blueprints/
COPY wizeworks/packages/cms-schemas/package.json wizeworks/packages/cms-schemas/
COPY wizeworks/packages/commerce-schemas/package.json wizeworks/packages/commerce-schemas/
COPY wizeworks/packages/crm-schemas/package.json wizeworks/packages/crm-schemas/
COPY wizeworks/packages/field-schema/package.json wizeworks/packages/field-schema/
COPY wizeworks/packages/integrations/package.json wizeworks/packages/integrations/
COPY wizeworks/packages/marketplace-schemas/package.json wizeworks/packages/marketplace-schemas/
COPY wizeworks/packages/silica-catalog/package.json wizeworks/packages/silica-catalog/
COPY wizeworks/packages/silica-corrections/package.json wizeworks/packages/silica-corrections/
COPY wizeworks/packages/site-themes/package.json wizeworks/packages/site-themes/
COPY wizeworks/packages/sitebuilder-schemas/package.json wizeworks/packages/sitebuilder-schemas/
COPY wizeworks/packages/story-schemas/package.json wizeworks/packages/story-schemas/
# The social calendar renders its empty posting slots from `slotOccurrences`, so the
# recurring-time maths is imported from @wizeworks/social rather than reimplemented — the
# plan a person sees has to be the plan the filler runs. Its root barrel is pure, but the
# package DECLARES @wizeworks/api-core, so api-core comes along for the filtered install
# (its own closure — cms-schemas, db, events — is already above).
COPY wizeworks/packages/api-core/package.json wizeworks/packages/api-core/
COPY wizeworks/packages/social/package.json wizeworks/packages/social/
# The sequence editor imports @wizeworks/email-sequences/schemas — the client-safe zod
# subpath, no db and no server code. The PACKAGE still declares @wizeworks/db and
# @wizeworks/email-sends, and the filtered install resolves what a package DECLARES, not
# what a surface imports, so email-sends has to be here too (db is already above).
COPY wizeworks/packages/email-sends/package.json wizeworks/packages/email-sends/
COPY wizeworks/packages/email-sequences/package.json wizeworks/packages/email-sequences/
# Root postinstall runs `pnpm --filter @wizeworks/db db:generate`, which needs
# both the schema source AND the prisma config file (the multi-file schema
# lives in prisma/schema/, declared in prisma.config.ts).
COPY wizeworks/packages/db/prisma wizeworks/packages/db/prisma
COPY wizeworks/packages/db/prisma.config.ts wizeworks/packages/db/prisma.config.ts

# Install only the @sparx/workbench subgraph (its deps + transitive workspace deps).
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @sparx/workbench...

# Source for every workspace dep + the app itself.
COPY wizeworks/packages/app-kit wizeworks/packages/app-kit
COPY wizeworks/packages/api-client wizeworks/packages/api-client
COPY wizeworks/packages/auth wizeworks/packages/auth
COPY wizeworks/packages/brand-core wizeworks/packages/brand-core
COPY sparx/packages/brand sparx/packages/brand
COPY wizeworks/packages/links wizeworks/packages/links
COPY wizeworks/packages/migration wizeworks/packages/migration
COPY wizeworks/packages/query wizeworks/packages/query
COPY wizeworks/packages/attribution wizeworks/packages/attribution
COPY wizeworks/packages/db wizeworks/packages/db
COPY wizeworks/packages/email wizeworks/packages/email
COPY wizeworks/packages/events wizeworks/packages/events
COPY wizeworks/packages/legal wizeworks/packages/legal
COPY wizeworks/packages/legal-seed wizeworks/packages/legal-seed
COPY wizeworks/packages/legal-templates wizeworks/packages/legal-templates
COPY wizeworks/packages/modules wizeworks/packages/modules
COPY wizeworks/packages/builder-schemas wizeworks/packages/builder-schemas
COPY wizeworks/packages/cms-editor wizeworks/packages/cms-editor
COPY wizeworks/packages/ui wizeworks/packages/ui
COPY wizeworks/packages/automation-schemas wizeworks/packages/automation-schemas
COPY wizeworks/packages/blueprints wizeworks/packages/blueprints
COPY wizeworks/packages/cms-schemas wizeworks/packages/cms-schemas
COPY wizeworks/packages/commerce-schemas wizeworks/packages/commerce-schemas
COPY wizeworks/packages/crm-schemas wizeworks/packages/crm-schemas
COPY wizeworks/packages/field-schema wizeworks/packages/field-schema
COPY wizeworks/packages/integrations wizeworks/packages/integrations
COPY wizeworks/packages/marketplace-schemas wizeworks/packages/marketplace-schemas
COPY wizeworks/packages/silica-catalog wizeworks/packages/silica-catalog
COPY wizeworks/packages/silica-corrections wizeworks/packages/silica-corrections
COPY wizeworks/packages/site-themes wizeworks/packages/site-themes
COPY wizeworks/packages/sitebuilder-schemas wizeworks/packages/sitebuilder-schemas
COPY wizeworks/packages/story-schemas wizeworks/packages/story-schemas
COPY wizeworks/packages/api-core wizeworks/packages/api-core
COPY wizeworks/packages/social wizeworks/packages/social
COPY wizeworks/packages/email-sends wizeworks/packages/email-sends
COPY wizeworks/packages/email-sequences wizeworks/packages/email-sequences
COPY sparx/apps/workbench sparx/apps/workbench

# Generate Prisma client (@wizeworks/auth imports @wizeworks/db which re-exports it).
RUN pnpm --filter @wizeworks/db db:generate

# Stamp the release version into the client bundle. NEXT_PUBLIC_* is inlined at
# build time, so the JS a browser tab is running carries the version it was built
# from; the runner stage exposes the same value at runtime for /api/version to
# compare against (mismatch ⇒ a new release shipped ⇒ "reload" prompt). Declared
# right before the build so a version bump never busts the cached dependency /
# source layers above it.
ARG APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION

# PostHog product analytics — browser-side only (NEXT_PUBLIC_*), so it's inlined
# into the client bundle at build time. CI passes these to every image
# (build-images-gcp.yml); a build without the key simply ships PostHog disabled (the
# provider bails on `if (!key) return`). HOST defaults to PostHog US cloud.
ARG NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST

# NODE_OPTIONS on the RUN line, NOT an ENV: the runner stage below is a separate
# FROM and sets its own cap to match the pod's memory limit, which must never be
# shadowed by a build-time value.
#
# `next build` runs TypeScript over the whole surface layer, and at 306 surfaces
# that program no longer fits V8's DEFAULT old-space ceiling (~4 GB). It does not
# fail as a type error — the build worker dies with `Ineffective mark-compacts
# near heap limit` and `SIGABRT`, which reads as a broken build rather than a
# box that ran short. The same wall has already been hit by `@wizeworks/api-rest`
# (pre-push, CI) and `@wizeworks/api-mcp` (CI at 6144); this is the third.
#
# Each image builds on its own runner (release.yml's matrix, max-parallel 6), so
# 8192 is one build against 16 GB rather than six sharing it.
RUN NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter @sparx/workbench build

# ----- Production runner -----
FROM node:${NODE_VERSION} AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Same release version as the client bundle above, exposed at runtime so the
# /api/version route can report what this pod is serving. During a rolling deploy
# an old tab (built from APP_VERSION=A) polls a new pod (serving B) → mismatch.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/apps/workbench/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/workbench/.next/static ./apps/workbench/.next/static
# public/ is NOT bundled into standalone output — copy it explicitly.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/workbench/public ./apps/workbench/public

USER nextjs

EXPOSE 3000

CMD ["node", "sparx/apps/workbench/server.js"]
