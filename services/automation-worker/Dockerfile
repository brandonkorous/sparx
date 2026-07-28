# automation-worker runtime image (docs/84 Slice D).
# Cloud Run service: Cloud Scheduler tick (/internal/cron/tick) + Pub/Sub push (/).
# Exposes :8080 (PORT env var). Connects as sparx_app; cross-tenant discovery via
# SECURITY DEFINER helpers — no owner connection needed.

FROM node:24-alpine

RUN apk add --no-cache dumb-init

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
# Workspace closure (11 packages, all backend-safe — no React/UI/auth). The engine
# half: automation → automation-schemas + db + events. The executor half:
# automation-actions → crm (now slim: commerce-schemas + crm-schemas + db +
# modules) — the heavy ui/auth/email/cms-editor deps were removed from @sparx/crm
# (docs/84 Slice F1 follow-up). The email executors enqueue through @sparx/email-sends,
# a LEAN producer (db only) — deliberately NOT @sparx/email-platform, which would
# drag @sparx/email + @sparx/ui + React into this image (docs/84 Slice F1).
# @sparx/builder-schemas is zod-only — it carries the {{token}} merge grammar the
# internal-alert sends interpolate (docs/91 §3). @sparx/email-sequences is another
# LEAN producer (db + email-sends only) — the sequence drain + enrol executors,
# same no-render rationale as email-sends. pnpm needs every workspace source dir in
# the dependency tree present to install.
COPY packages/automation ./packages/automation
COPY packages/automation-schemas ./packages/automation-schemas
COPY packages/automation-actions ./packages/automation-actions
COPY packages/builder-schemas ./packages/builder-schemas
COPY packages/email-sends ./packages/email-sends
COPY packages/email-sequences ./packages/email-sequences
COPY packages/crm ./packages/crm
COPY packages/crm-schemas ./packages/crm-schemas
COPY packages/commerce-schemas ./packages/commerce-schemas
COPY packages/inventory ./packages/inventory
COPY packages/modules ./packages/modules
COPY packages/db ./packages/db
COPY packages/events ./packages/events
COPY services/automation-worker ./services/automation-worker

RUN pnpm install --filter @sparx/automation-worker... --frozen-lockfile --prod=false

RUN cd packages/db && pnpm exec prisma generate

WORKDIR /app/services/automation-worker

RUN chown -R node:node /app
USER node

EXPOSE 8080

ENTRYPOINT ["dumb-init", "--", "node", "--import", "tsx", "src/index.ts"]
