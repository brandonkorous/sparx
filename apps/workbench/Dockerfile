# syntax=docker/dockerfile:1.7
#
# Multi-stage Next.js build for @sparx/workbench — the multi-window workbench
# at workbench.sparx.works. Produces a standalone bundle on Node 24 alpine.
#
# Built from the repo root context (per .github/workflows/build-images.yml):
#   docker build -f apps/workbench/Dockerfile -t sparx/workbench:tag .

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# ----- Install + build -----
FROM base AS builder

# Workspace metadata first — maximises layer cache reuse across source changes.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/workbench/package.json apps/workbench/
# The workbench's direct workspace deps are deliberately few — it is a browser-
# rendered app whose only server surface is Better Auth + the /api/token BFF:
COPY packages/api-client/package.json packages/api-client/
COPY packages/auth/package.json packages/auth/
COPY packages/brand/package.json packages/brand/
COPY packages/query/package.json packages/query/
# …and @sparx/auth's transitive closure. Its index re-exports server.ts →
# tenant-events.ts, which pulls legal seeding; @sparx/email (a direct auth dep)
# pulls the template packages. Every member must be present or the filtered
# install leaves a dangling symlink that the build fails to resolve.
COPY packages/attribution/package.json packages/attribution/
COPY packages/db/package.json packages/db/
COPY packages/email/package.json packages/email/
COPY packages/events/package.json packages/events/
COPY packages/legal/package.json packages/legal/
COPY packages/legal-seed/package.json packages/legal-seed/
COPY packages/legal-templates/package.json packages/legal-templates/
COPY packages/modules/package.json packages/modules/
COPY packages/builder-schemas/package.json packages/builder-schemas/
COPY packages/cms-editor/package.json packages/cms-editor/
COPY packages/ui/package.json packages/ui/
# The surface layer's schema + catalog deps and their transitive @sparx closure.
# The workbench is no longer "deliberately few" deps — its ~66 surfaces import
# the commerce/crm/automation/story/marketplace/cms/sitebuilder schemas, the
# silica catalog, site themes, and blueprints directly. Every member must be
# present or the filtered install leaves a dangling symlink the build can't
# resolve (the Module-not-found class of failure).
COPY packages/automation-schemas/package.json packages/automation-schemas/
COPY packages/blueprints/package.json packages/blueprints/
COPY packages/cms-schemas/package.json packages/cms-schemas/
COPY packages/commerce-schemas/package.json packages/commerce-schemas/
COPY packages/crm-schemas/package.json packages/crm-schemas/
COPY packages/marketplace-schemas/package.json packages/marketplace-schemas/
COPY packages/silica-catalog/package.json packages/silica-catalog/
COPY packages/site-themes/package.json packages/site-themes/
COPY packages/sitebuilder-schemas/package.json packages/sitebuilder-schemas/
COPY packages/story-schemas/package.json packages/story-schemas/
# Root postinstall runs `pnpm --filter @sparx/db db:generate`, which needs
# both the schema source AND the prisma config file (the multi-file schema
# lives in prisma/schema/, declared in prisma.config.ts).
COPY packages/db/prisma packages/db/prisma
COPY packages/db/prisma.config.ts packages/db/prisma.config.ts

# Install only the @sparx/workbench subgraph (its deps + transitive workspace deps).
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @sparx/workbench...

# Source for every workspace dep + the app itself.
COPY packages/api-client packages/api-client
COPY packages/auth packages/auth
COPY packages/brand packages/brand
COPY packages/query packages/query
COPY packages/attribution packages/attribution
COPY packages/db packages/db
COPY packages/email packages/email
COPY packages/events packages/events
COPY packages/legal packages/legal
COPY packages/legal-seed packages/legal-seed
COPY packages/legal-templates packages/legal-templates
COPY packages/modules packages/modules
COPY packages/builder-schemas packages/builder-schemas
COPY packages/cms-editor packages/cms-editor
COPY packages/ui packages/ui
COPY packages/automation-schemas packages/automation-schemas
COPY packages/blueprints packages/blueprints
COPY packages/cms-schemas packages/cms-schemas
COPY packages/commerce-schemas packages/commerce-schemas
COPY packages/crm-schemas packages/crm-schemas
COPY packages/marketplace-schemas packages/marketplace-schemas
COPY packages/silica-catalog packages/silica-catalog
COPY packages/site-themes packages/site-themes
COPY packages/sitebuilder-schemas packages/sitebuilder-schemas
COPY packages/story-schemas packages/story-schemas
COPY apps/workbench apps/workbench

# Generate Prisma client (@sparx/auth imports @sparx/db which re-exports it).
RUN pnpm --filter @sparx/db db:generate

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
# (build-images.yml); a build without the key simply ships PostHog disabled (the
# provider bails on `if (!key) return`). HOST defaults to PostHog US cloud.
ARG NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST

RUN pnpm --filter @sparx/workbench build

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

CMD ["node", "apps/workbench/server.js"]
