# sparx Inventory Bridge — optional container image for tenants who'd rather run the
# Tier A agent as a container than a host service. Outbound HTTPS only; mount the
# ERP export folder and pass config via --env-file. Not deployed to sparx infra —
# this ships to the tenant.

FROM node:24-alpine

RUN apk add --no-cache dumb-init
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
# Root `patchedDependencies` is hashed before resolution, so the patch files are
# needed even when this filter excludes the package they patch.
COPY patches ./patches
COPY services/inventory-bridge ./services/inventory-bridge

RUN pnpm install --filter @sparx/inventory-bridge... --frozen-lockfile --prod=false

WORKDIR /app/services/inventory-bridge

RUN chown -R node:node /app
USER node

ENTRYPOINT ["dumb-init", "--", "node", "--import", "tsx", "src/index.ts"]
