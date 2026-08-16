# syntax=docker/dockerfile:1.7
#
# @piggles/web — meetpiggles.com, the marketing site. Standalone Next.js on
# Node 24 alpine, built from the repo ROOT context:
#
#   docker build -f piggles/apps/web/Dockerfile -t piggles/web:tag .
#
# THE SMALLEST IMAGE IN THE REPO, and deliberately so: this app's entire
# workspace closure is `@piggles/{brand,config,mascot}` and NOT ONE `@sparx/*`
# package. It talks to nothing — no database, no api-rest, no auth — which is
# also why it is the one Piggles surface that can ship on its own (STATUS.md's
# sequencing note: the account app before the console gives a live funnel with a
# dead end, but the marketing site stands alone).
#
# Keep it that way. A `@sparx/*` dependency appearing here is worth a second
# look before it is copied in: it would mean the marketing site had grown a
# server-side call it did not have.

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# ----- Install + build -----
FROM base AS builder

# Workspace metadata first — maximises layer cache reuse across source changes.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json .npmrc ./
# Root `patchedDependencies` is hashed BEFORE resolution, so pnpm opens every
# patch file even under a filter that excludes the package being patched. Absent,
# the install dies with ENOENT on a package this app does not use.
COPY patches ./patches
COPY piggles/apps/web/package.json piggles/apps/web/
# The whole closure, and it is three packages.
COPY piggles/packages/brand/package.json piggles/packages/brand/
COPY piggles/packages/config/package.json piggles/packages/config/
COPY piggles/packages/mascot/package.json piggles/packages/mascot/
COPY piggles/packages/ui/package.json piggles/packages/ui/

# The Font Awesome Pro token reaches pnpm as an env var for one command, read
# from a BuildKit secret mount. It is never COPYed and never lands in a layer.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    --mount=type=secret,id=fontawesome_npm_token \
    FONTAWESOME_NPM_TOKEN="$(cat /run/secrets/fontawesome_npm_token 2>/dev/null || true)" \
    pnpm install --frozen-lockfile --filter @piggles/web...

# Source for every workspace dep + the app itself. All three ship TypeScript
# source rather than a build output (`exports` points at `./src/…`), so the app's
# `transpilePackages` compiles them — which means the SOURCE has to be here, not
# just the manifest.
COPY piggles/packages/brand piggles/packages/brand
COPY piggles/packages/config piggles/packages/config
COPY piggles/packages/mascot piggles/packages/mascot
COPY piggles/packages/ui piggles/packages/ui
COPY piggles/apps/web piggles/apps/web

# Stamped into the client bundle at build time (NEXT_PUBLIC_* is inlined), and
# exposed again at runtime below so a running pod can report what it is serving.
# Declared right before the build so bumping it never busts the cached dependency
# and source layers above.
ARG APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION

ARG NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST

# No NODE_OPTIONS bump here. 44 static routes over three small packages is
# nowhere near the ceiling the console and api-rest run into; adding a cap this
# build does not need would only hide the day it starts to.
RUN pnpm --filter @piggles/web build

# ----- Production runner -----
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# `outputFileTracingRoot` is the repo root, so the standalone tree reproduces the
# repo's own shape and the server entrypoint keeps its full path.
COPY --from=builder --chown=nextjs:nodejs /repo/piggles/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/piggles/apps/web/.next/static ./piggles/apps/web/.next/static
# public/ is NOT bundled into standalone output — and here it is 38 MB of video,
# photography and the mascot, which is most of what this site IS.
COPY --from=builder --chown=nextjs:nodejs /repo/piggles/apps/web/public ./piggles/apps/web/public

USER nextjs

EXPOSE 3000

CMD ["node", "piggles/apps/web/server.js"]
