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
# the platform's whole account spine: `@wizeworks/auth`, `@wizeworks/db`, and the
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
COPY piggles/apps/account/package.json piggles/apps/account/

# Piggles' own: the handoff (both halves), the tokens, the app registry, the art.
COPY piggles/packages/auth-handoff/package.json piggles/packages/auth-handoff/
COPY piggles/packages/brand/package.json piggles/packages/brand/
COPY piggles/packages/config/package.json piggles/packages/config/
COPY piggles/packages/mascot/package.json piggles/packages/mascot/
COPY piggles/packages/ui/package.json piggles/packages/ui/

# The platform account spine and everything it drags in. `@wizeworks/auth` re-exports
# server.ts → tenant-events.ts, which pulls legal seeding; `@wizeworks/email` pulls
# the template packages; onboarding's blueprint step pulls the schema family.
COPY wizeworks/packages/attribution/package.json wizeworks/packages/attribution/
COPY wizeworks/packages/auth/package.json wizeworks/packages/auth/
COPY wizeworks/packages/brand-core/package.json wizeworks/packages/brand-core/
# The address table. The invite + consent pages build absolute links
# through it (accountOrigin/appOrigin), during the SERVER render.
COPY wizeworks/packages/links/package.json wizeworks/packages/links/
# Capacity metering. The account page reads it during the SERVER render — this is
# the surface that owns the full picture of what a business is using.
COPY wizeworks/packages/usage/package.json wizeworks/packages/usage/
COPY wizeworks/packages/silica-corrections/package.json wizeworks/packages/silica-corrections/
COPY wizeworks/packages/automation-schemas/package.json wizeworks/packages/automation-schemas/
COPY wizeworks/packages/blueprints/package.json wizeworks/packages/blueprints/
COPY sparx/packages/brand/package.json sparx/packages/brand/
COPY wizeworks/packages/builder-schemas/package.json wizeworks/packages/builder-schemas/
COPY wizeworks/packages/cms-editor/package.json wizeworks/packages/cms-editor/
COPY wizeworks/packages/cms-schemas/package.json wizeworks/packages/cms-schemas/
COPY wizeworks/packages/commerce-schemas/package.json wizeworks/packages/commerce-schemas/
COPY wizeworks/packages/crm-schemas/package.json wizeworks/packages/crm-schemas/
COPY wizeworks/packages/db/package.json wizeworks/packages/db/
COPY wizeworks/packages/email/package.json wizeworks/packages/email/
COPY wizeworks/packages/events/package.json wizeworks/packages/events/
COPY wizeworks/packages/field-schema/package.json wizeworks/packages/field-schema/
COPY wizeworks/packages/legal/package.json wizeworks/packages/legal/
COPY wizeworks/packages/legal-seed/package.json wizeworks/packages/legal-seed/
COPY wizeworks/packages/legal-templates/package.json wizeworks/packages/legal-templates/
COPY wizeworks/packages/marketplace-schemas/package.json wizeworks/packages/marketplace-schemas/
COPY wizeworks/packages/modules/package.json wizeworks/packages/modules/
COPY wizeworks/packages/silica-catalog/package.json wizeworks/packages/silica-catalog/
COPY wizeworks/packages/site-themes/package.json wizeworks/packages/site-themes/
COPY wizeworks/packages/sitebuilder-schemas/package.json wizeworks/packages/sitebuilder-schemas/
COPY wizeworks/packages/ui/package.json wizeworks/packages/ui/

# Root postinstall runs `pnpm --filter @wizeworks/db db:generate`, which needs the
# schema source AND the prisma config (the multi-file schema lives in
# prisma/schema/, declared in prisma.config.ts).
COPY wizeworks/packages/db/prisma wizeworks/packages/db/prisma
COPY wizeworks/packages/db/prisma.config.ts wizeworks/packages/db/prisma.config.ts

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
COPY wizeworks/packages/attribution wizeworks/packages/attribution
COPY wizeworks/packages/auth wizeworks/packages/auth
COPY wizeworks/packages/brand-core wizeworks/packages/brand-core
COPY wizeworks/packages/links wizeworks/packages/links
COPY wizeworks/packages/usage wizeworks/packages/usage
COPY wizeworks/packages/silica-corrections wizeworks/packages/silica-corrections
COPY wizeworks/packages/automation-schemas wizeworks/packages/automation-schemas
COPY wizeworks/packages/blueprints wizeworks/packages/blueprints
COPY sparx/packages/brand sparx/packages/brand
COPY wizeworks/packages/builder-schemas wizeworks/packages/builder-schemas
COPY wizeworks/packages/cms-editor wizeworks/packages/cms-editor
COPY wizeworks/packages/cms-schemas wizeworks/packages/cms-schemas
COPY wizeworks/packages/commerce-schemas wizeworks/packages/commerce-schemas
COPY wizeworks/packages/crm-schemas wizeworks/packages/crm-schemas
COPY wizeworks/packages/db wizeworks/packages/db
COPY wizeworks/packages/email wizeworks/packages/email
COPY wizeworks/packages/events wizeworks/packages/events
COPY wizeworks/packages/field-schema wizeworks/packages/field-schema
COPY wizeworks/packages/legal wizeworks/packages/legal
COPY wizeworks/packages/legal-seed wizeworks/packages/legal-seed
COPY wizeworks/packages/legal-templates wizeworks/packages/legal-templates
COPY wizeworks/packages/marketplace-schemas wizeworks/packages/marketplace-schemas
COPY wizeworks/packages/modules wizeworks/packages/modules
COPY wizeworks/packages/silica-catalog wizeworks/packages/silica-catalog
COPY wizeworks/packages/site-themes wizeworks/packages/site-themes
COPY wizeworks/packages/sitebuilder-schemas wizeworks/packages/sitebuilder-schemas
COPY wizeworks/packages/ui wizeworks/packages/ui
COPY piggles/apps/account piggles/apps/account

# @wizeworks/auth imports @wizeworks/db, which re-exports the generated client.
RUN pnpm --filter @wizeworks/db db:generate

ARG APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION

ARG NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST

# Eleven routes, but the type program spans @wizeworks/auth and the whole schema
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
