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
# @sparx/auth's index re-exports server.ts/sign-up.ts → tenant-events.ts, which
# imports @sparx/legal-seed (in-process tenant.created legal-page seeding). It in
# turn imports the dependency-free @sparx/legal-templates. Both must be present or
# the filtered install leaves a dangling symlink that Turbopack fails to resolve.
COPY packages/legal-seed/package.json packages/legal-seed/
COPY packages/legal-templates/package.json packages/legal-templates/
COPY packages/db/package.json packages/db/
COPY packages/email/package.json packages/email/
COPY packages/events/package.json packages/events/
COPY packages/crm/package.json packages/crm/
COPY packages/crm-schemas/package.json packages/crm-schemas/
COPY packages/commerce/package.json packages/commerce/
COPY packages/inventory/package.json packages/inventory/
COPY packages/commerce-schemas/package.json packages/commerce-schemas/
# @sparx/payments is a dep of @sparx/commerce (checkout/return services); its only
# workspace dep is @sparx/db (above). Needed for the filtered install to resolve.
COPY packages/payments/package.json packages/payments/
COPY packages/integration-framework/package.json packages/integration-framework/
COPY packages/provider-avalara/package.json packages/provider-avalara/
COPY packages/provider-easypost/package.json packages/provider-easypost/
COPY packages/provider-paypal/package.json packages/provider-paypal/
COPY packages/provider-shippo/package.json packages/provider-shippo/
COPY packages/provider-taxjar/package.json packages/provider-taxjar/
COPY packages/query/package.json packages/query/
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
# @sparx/builder-render — the shared canvas↔live render path (docs/builder/02), a
# dashboard dep. Its workspace deps (builder-schemas, cms-editor, site-ui) are above.
COPY packages/builder-render/package.json packages/builder-render/
# @sparx/surface-compile — the dashboard imports its client-safe `/allowlist`
# predicate (the builder's Import-HTML class validation in html-actions.ts). Only
# workspace dep is @sparx/builder-schemas (above); the heavy tailwind/lightningcss
# deps belong to its server-only compile path, which the dashboard never imports.
COPY packages/surface-compile/package.json packages/surface-compile/
COPY packages/attribution/package.json packages/attribution/
# Automation authoring UI (docs/84 Slice G-UI) — pure zod schemas + the
# triggerToColumns/FromColumns round-trip helpers; only dep is zod (already present).
COPY packages/automation-schemas/package.json packages/automation-schemas/
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
COPY packages/legal-seed packages/legal-seed
COPY packages/legal-templates packages/legal-templates
COPY packages/db packages/db
COPY packages/email packages/email
COPY packages/events packages/events
COPY packages/crm packages/crm
COPY packages/crm-schemas packages/crm-schemas
COPY packages/commerce packages/commerce
COPY packages/inventory packages/inventory
COPY packages/commerce-schemas packages/commerce-schemas
COPY packages/payments packages/payments
COPY packages/integration-framework packages/integration-framework
COPY packages/provider-avalara packages/provider-avalara
COPY packages/provider-easypost packages/provider-easypost
COPY packages/provider-paypal packages/provider-paypal
COPY packages/provider-shippo packages/provider-shippo
COPY packages/provider-taxjar packages/provider-taxjar
COPY packages/query packages/query
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
COPY packages/builder-render packages/builder-render
COPY packages/surface-compile packages/surface-compile
COPY packages/attribution packages/attribution
COPY packages/automation-schemas packages/automation-schemas
COPY apps/dashboard apps/dashboard

# Generate Prisma client (the dashboard imports @sparx/db which re-exports it).
RUN pnpm --filter @sparx/db db:generate

# @sparx/site-ui ships its stylesheets as BUILD artifacts (dist/styles.css +
# dist/styles.canvas.css, Tailwind @apply → plain CSS); dist is gitignored, so a
# fresh CI checkout lacks it. Build it before the app so the Builder canvas's
# `import '@sparx/site-ui/styles.canvas.css'` resolves. tailwind CLI is an
# installed devDep of site-ui (the filtered install above is not --prod).
RUN pnpm --filter @sparx/site-ui build

# Stamp the release version into the client bundle. NEXT_PUBLIC_* is inlined at
# build time, so the JS a browser tab is running carries the version it was built
# from; the runner stage exposes the same value at runtime for /api/version to
# compare against (mismatch ⇒ a new release shipped ⇒ "refresh" prompt). Declared
# right before the build so a version bump never busts the cached dependency /
# source layers above it.
ARG APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION

# PostHog analytics — like APP_VERSION, NEXT_PUBLIC_* is inlined here at build
# time; runtime env can't reach an already-bundled client JS. Passed as a
# build-arg from build-images.yml. Absent ⇒ the provider no-ops (`if (!key)
# return`), so a build without the arg simply ships PostHog disabled. HOST
# carries the canonical default so a plain `docker build` needs no arg.
ARG NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST

RUN pnpm --filter @sparx/dashboard build

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

COPY --from=builder --chown=nextjs:nodejs /repo/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/dashboard/.next/static ./apps/dashboard/.next/static
# public/ is NOT bundled into standalone output — copy it explicitly so the
# manifest icons (android-chrome-*.png) serve.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/dashboard/public ./apps/dashboard/public

USER nextjs

EXPOSE 3000

CMD ["node", "apps/dashboard/server.js"]
