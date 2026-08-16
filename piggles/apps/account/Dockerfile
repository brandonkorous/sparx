# syntax=docker/dockerfile:1.7
#
# @piggles/account — getpiggles.com. Sign-up, sign-in, onboarding, provisioning,
# and the money a customer pays WizeWorks. Standalone Next.js on Node 24 alpine,
# built from the repo ROOT context:
#
#   docker build -f piggles/apps/account/Dockerfile -t piggles/account:tag .
#
# This is the AUTH AUTHORITY for the Piggles brand — mypiggles.com mounts no
# Better Auth handler and receives its session through the handoff — so it needs
# the platform's whole account spine: `@sparx/auth`, `@sparx/db`, and the
# transitive closure of `signUpMerchant` (a tenant, its primary site, the
# subdomain, the owner membership, legal acceptance, the trial clock, the welcome
# email). Twenty-three `@sparx/*` packages and four `@piggles/*` ones, every one
# of them because a package DECLARES it, not because a file imports it — the
# filtered install resolves declarations, so a transitive member left out leaves
# a dangling symlink the build cannot resolve.
#
# Verified against the closure by scripts/check-dockerfile-deps.mjs, which now
# reads piggles/* as well. Do not hand-edit this list without re-running it.

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# ----- Install + build -----
FROM base AS builder

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json .npmrc ./
# Hashed before resolution — needed whatever the filter excludes. See the note in
# piggles/apps/web/Dockerfile.
COPY patches ./patches
COPY piggles/apps/account/package.json piggles/apps/account/

# Piggles' own: the handoff (both halves), the tokens, the app registry, the art.
COPY piggles/packages/auth-handoff/package.json piggles/packages/auth-handoff/
COPY piggles/packages/brand/package.json piggles/packages/brand/
COPY piggles/packages/config/package.json piggles/packages/config/
COPY piggles/packages/mascot/package.json piggles/packages/mascot/
COPY piggles/packages/ui/package.json piggles/packages/ui/

# The platform account spine and everything it drags in. `@sparx/auth` re-exports
# server.ts → tenant-events.ts, which pulls legal seeding; `@sparx/email` pulls
# the template packages; onboarding's blueprint step pulls the schema family.
COPY packages/attribution/package.json packages/attribution/
COPY packages/auth/package.json packages/auth/
# The address table. The invite + consent pages build absolute links
# through it (accountOrigin/appOrigin), during the SERVER render.
COPY packages/links/package.json packages/links/
COPY packages/silica-corrections/package.json packages/silica-corrections/
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
COPY packages/events/package.json packages/events/
COPY packages/field-schema/package.json packages/field-schema/
COPY packages/legal/package.json packages/legal/
COPY packages/legal-seed/package.json packages/legal-seed/
COPY packages/legal-templates/package.json packages/legal-templates/
COPY packages/marketplace-schemas/package.json packages/marketplace-schemas/
COPY packages/modules/package.json packages/modules/
COPY packages/silica-catalog/package.json packages/silica-catalog/
COPY packages/site-themes/package.json packages/site-themes/
COPY packages/sitebuilder-schemas/package.json packages/sitebuilder-schemas/
COPY packages/ui/package.json packages/ui/

# Root postinstall runs `pnpm --filter @sparx/db db:generate`, which needs the
# schema source AND the prisma config (the multi-file schema lives in
# prisma/schema/, declared in prisma.config.ts).
COPY packages/db/prisma packages/db/prisma
COPY packages/db/prisma.config.ts packages/db/prisma.config.ts

# The Font Awesome Pro token reaches pnpm as an env var for one command, read
# from a BuildKit secret mount. It is never COPYed and never lands in a layer.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    --mount=type=secret,id=fontawesome_npm_token \
    FONTAWESOME_NPM_TOKEN="$(cat /run/secrets/fontawesome_npm_token 2>/dev/null || true)" \
    pnpm install --frozen-lockfile --filter @piggles/account...

# Source for every workspace dep + the app itself.
COPY piggles/packages/auth-handoff piggles/packages/auth-handoff
COPY piggles/packages/brand piggles/packages/brand
COPY piggles/packages/config piggles/packages/config
COPY piggles/packages/mascot piggles/packages/mascot
COPY piggles/packages/ui piggles/packages/ui
COPY packages/attribution packages/attribution
COPY packages/auth packages/auth
COPY packages/links packages/links
COPY packages/silica-corrections packages/silica-corrections
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
COPY packages/events packages/events
COPY packages/field-schema packages/field-schema
COPY packages/legal packages/legal
COPY packages/legal-seed packages/legal-seed
COPY packages/legal-templates packages/legal-templates
COPY packages/marketplace-schemas packages/marketplace-schemas
COPY packages/modules packages/modules
COPY packages/silica-catalog packages/silica-catalog
COPY packages/site-themes packages/site-themes
COPY packages/sitebuilder-schemas packages/sitebuilder-schemas
COPY packages/ui packages/ui
COPY piggles/apps/account piggles/apps/account

# @sparx/auth imports @sparx/db, which re-exports the generated client.
RUN pnpm --filter @sparx/db db:generate

ARG APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION

ARG NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST

# Eleven routes, but the type program spans @sparx/auth and the whole schema
# family, so this sits above the small-app default and below the console's.
RUN NODE_OPTIONS=--max-old-space-size=6144 pnpm --filter @piggles/account build

# ----- Production runner -----
FROM node:${NODE_VERSION} AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/piggles/apps/account/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/piggles/apps/account/.next/static ./piggles/apps/account/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/piggles/apps/account/public ./piggles/apps/account/public

USER nextjs

EXPOSE 3000

CMD ["node", "piggles/apps/account/server.js"]
