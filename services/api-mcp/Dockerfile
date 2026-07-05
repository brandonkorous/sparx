# api-mcp runtime image. Same shape as services/api-rest/Dockerfile.
#
# Built by GitHub Actions, pushed to
# us-central1-docker.pkg.dev/sparxworks/sparx/api-mcp:<sha>.

FROM node:24-alpine

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Workspace context. Only the packages api-mcp transitively depends on are
# copied in so `pnpm install --filter` doesn't drag the entire monorepo
# into the image.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/db ./packages/db
COPY packages/auth ./packages/auth
COPY packages/modules ./packages/modules
COPY packages/legal ./packages/legal
# @sparx/auth's index (server.ts imports isModuleEnabled here) statically pulls
# sign-up.ts → tenant-events.ts → @sparx/legal-seed → @sparx/legal-templates. Under
# `node --import tsx` the whole graph evaluates at boot, so both must be present or
# the service crashloops with ERR_MODULE_NOT_FOUND. (legal-templates is dep-free;
# legal-seed's @sparx/db dep is already above.)
COPY packages/legal-seed ./packages/legal-seed
COPY packages/legal-templates ./packages/legal-templates
COPY packages/events ./packages/events
# @sparx/cms (CMS content service + MCP tools, docs/12). Its service layer sits on
# @sparx/api-core (error envelope / slug / pubsub) + @sparx/cms-schemas (field
# schemas); db + events are already above. This is the FIRST consumer to pull
# @sparx/api-core into the MCP image — missing any of these three → boot crashloop
# with ERR_MODULE_NOT_FOUND.
COPY packages/cms-schemas ./packages/cms-schemas
COPY packages/api-core ./packages/api-core
COPY packages/cms ./packages/cms
# @sparx/automation MCP tools (the AI authoring path) call only the automation
# SERVICE layer → closure is just these two (db/events already above; the module
# executors in @sparx/automation-actions are NOT pulled in — the AI authors
# rules, it never fires an effect directly).
COPY packages/automation-schemas ./packages/automation-schemas
COPY packages/automation ./packages/automation
COPY packages/builder-schemas ./packages/builder-schemas
# @sparx/builder (page-service behind the Builder MCP tools) + its transitive
# surface-compile dep. The MCP tools import @sparx/builder/mcp, a subpath that
# never loads surface-css-service, so the Tailwind compiler is installed but never
# evaluated at runtime — surface-compile is here only so pnpm can resolve the dep.
COPY packages/surface-compile ./packages/surface-compile
COPY packages/builder ./packages/builder
COPY packages/email ./packages/email
COPY packages/commerce-schemas ./packages/commerce-schemas
# @sparx/commerce's provider-service imports @sparx/integration-framework (the
# provider plug-in SDK) at module load — the commerce MCP tools pull it in — so it
# must be in the image. Its only workspace dep is commerce-schemas (above). Omitting
# it crashlooped api-mcp with ERR_MODULE_NOT_FOUND. (@sparx/commerce's other dep
# @sparx/ui is NOT copied — the MCP code path never loads it.)
COPY packages/integration-framework ./packages/integration-framework
# @sparx/commerce's checkout-service/return-service import @sparx/payments (the
# gateway SDK) at module load — the commerce MCP tools pull them in — so payments
# must be in the image. Its only workspace dep is @sparx/db (above). Omitting it
# crashlooped api-mcp with ERR_MODULE_NOT_FOUND on '@sparx/payments'.
COPY packages/payments ./packages/payments
# @sparx/commerce re-exports inventoryService from @sparx/inventory (the commerce
# MCP tools call it), so the inventory package must be in the image. Its workspace
# deps (@sparx/db, @sparx/commerce-schemas, @sparx/events) are all copied above.
COPY packages/inventory ./packages/inventory
# @sparx/commerce's market services (docs/106 §4.7) import @sparx/channels/crypto at
# module load (payout-account encryption), so channels must be in the image. It is
# dep-free (node builtins only). Omitting it would crashloop on '@sparx/channels'.
COPY packages/channels ./packages/channels
COPY packages/commerce ./packages/commerce
COPY packages/crm-schemas ./packages/crm-schemas
COPY packages/crm ./packages/crm
COPY packages/search ./packages/search
COPY packages/site-themes ./packages/site-themes
COPY packages/sitebuilder-schemas ./packages/sitebuilder-schemas
COPY packages/sitebuilder ./packages/sitebuilder
COPY packages/cms-editor ./packages/cms-editor
COPY packages/email-platform ./packages/email-platform
COPY packages/registrar ./packages/registrar
COPY packages/godaddy ./packages/godaddy
# @sparx/scheduling's MCP tools (docs/79 §11). Workspace deps: @sparx/db (above) +
# @sparx/scheduling-schemas (the write tools' input schemas).
COPY packages/scheduling-schemas ./packages/scheduling-schemas
COPY packages/scheduling ./packages/scheduling
# @sparx/media (the image upload / set MCP tools). Server-side original writes +
# a media.uploaded publish. Workspace deps @sparx/db + @sparx/events are already
# above; @google-cloud/storage is an npm dep resolved by pnpm install below.
COPY packages/media ./packages/media
COPY services/api-mcp ./services/api-mcp

RUN pnpm install --filter @sparx/api-mcp... --frozen-lockfile --prod=false

# Pre-generate the Prisma client so the first MCP tool call doesn't pay
# the cost. @sparx/crm services hit prisma via @sparx/db's tenant-scoped
# helpers — the audit-log write goes through the same connection.
RUN cd packages/db && pnpm exec prisma generate

WORKDIR /app/services/api-mcp

# GKE Autopilot enforces runAsNonRoot — node:24-alpine ships uid 1000.
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Run tsx directly via node (matches the `start` script), not via `pnpm exec`:
# pnpm re-invokes corepack at container start, which re-downloads pnpm from the
# npm registry on every cold start (build-time corepack cache is root-owned,
# unreadable by the runtime `node` user). This keeps corepack out of runtime.
ENTRYPOINT ["node", "--import", "tsx", "src/index.ts"]
