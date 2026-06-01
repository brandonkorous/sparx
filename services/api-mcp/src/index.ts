// Entry point. Boots the Fastify app and listens.

import { installCrmWebhookFanout, preconnectWebhookFanout } from '@sparx/crm';
import { installCrmPubSubBridge } from '@sparx/crm/pubsub';
import { env } from './env.js';
import { createApp } from './app.js';
import { preconnectAudit } from './audit.js';

async function main(): Promise<void> {
  const app = await createApp();
  await preconnectAudit();
  // Bridge CRM customer writes made via MCP tools to real Pub/Sub so they
  // reach the search index. MUST run before installCrmWebhookFanout() (it
  // wraps the active publisher). No-op when GCP_PROJECT_ID is unset.
  installCrmPubSubBridge({ projectId: env.GCP_PROJECT_ID, logger: console });
  // Wrap CRM publisher so write tools (create_deal, move_deal_stage, ...)
  // enqueue webhook deliveries through the same fan-out as REST + GraphQL.
  installCrmWebhookFanout();
  await preconnectWebhookFanout();
  await app.listen({ host: env.HOST, port: env.PORT });

  const shutdown = (signal: NodeJS.Signals): void => {
    app.log.info({ signal }, 'shutdown received');
    app
      .close()
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
