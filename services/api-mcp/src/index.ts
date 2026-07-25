// Entry point. Boots the Fastify app and listens.

import { configurePubsub } from '@sparx/api-core/pubsub';
import { installCrmWebhookFanout, preconnectWebhookFanout, registerCrmConsumers } from '@sparx/crm';
import { installCrmPubSubBridge } from '@sparx/crm/pubsub';
import { registerCommerceConsumers } from '@sparx/commerce/consumers';
import { env } from './env.js';
import { createApp } from './app.js';
import { preconnectAudit } from './audit.js';
import { closeBuilderRelay } from './builder-relay.js';

async function main(): Promise<void> {
  const app = await createApp();
  await preconnectAudit();
  // Hand api-core its Pub/Sub config before any tool handler can call publish().
  // WITHOUT this, `@sparx/api-core/pubsub`'s publish() fell back to the stdout stub
  // in this process, so every MCP write that emits through the api-core path —
  // inventory stock/threshold + `search.entity.changed`, social `social.post.*`
  // (the scheduled-publish worker never woke for an MCP-scheduled post), and CMS
  // events — was silently dropped in prod. The CRM + platform buses are bridged
  // separately below (their own module state), and tools that emit via @sparx/events
  // `createPublisher` (domain, search-admin, b2b) were already real; this closes the
  // api-core gap so ALL three paths reach real Pub/Sub. It also enables api-core's
  // webhook-enqueue for these MCP writes — matching api-rest — and the rows drain on
  // api-rest's shared webhook-delivery loop. Unset GCP_PROJECT_ID → stdout stub (dev).
  configurePubsub({ gcpProjectId: env.GCP_PROJECT_ID });
  // Bridge CRM customer writes made via MCP tools to real Pub/Sub so they
  // reach the search index. MUST run before installCrmWebhookFanout() (it
  // wraps the active publisher). No-op when GCP_PROJECT_ID is unset.
  installCrmPubSubBridge({ projectId: env.GCP_PROJECT_ID, logger: console });
  // Wire the in-process CRM consumers so order/customer mutations made via MCP
  // tools maintain customer stats + activity in THIS process (the platform bus
  // is in-process). See the api-rest bootstrap for the full rationale.
  registerCrmConsumers();
  // Commerce sell-path consumers (order.cancelled → inventory restock) on the
  // same in-process bus, gated per-tenant on the inventory module.
  registerCommerceConsumers();
  // Wrap CRM publisher so write tools (create_deal, move_deal_stage, ...)
  // enqueue webhook deliveries through the same fan-out as REST + GraphQL.
  installCrmWebhookFanout();
  await preconnectWebhookFanout();
  await app.listen({ host: env.HOST, port: env.PORT });

  const shutdown = (signal: NodeJS.Signals): void => {
    app.log.info({ signal }, 'shutdown received');
    Promise.all([app.close(), closeBuilderRelay()])
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        app.log.error({ err }, 'graceful shutdown failed');
        process.exit(1);
      });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

void main().catch((err: unknown) => {
  console.error('[mcp-server] failed to start', err);
  process.exit(1);
});
