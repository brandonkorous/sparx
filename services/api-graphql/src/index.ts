// Production / dev entrypoint. Boots the Fastify factory and wires up
// graceful shutdown. Tests import ./app.ts directly and skip listen().

import { resolveTransport } from '@sparx/events';
import { startWebhookDeliveryLoop } from '@sparx/api-core/webhook-delivery';
import { installCrmWebhookFanout, preconnectWebhookFanout, registerCrmConsumers } from '@sparx/crm';
import { installCrmPubSubBridge } from '@sparx/crm/pubsub';
import { createApp } from './app.js';
import { env } from './env.js';

async function main(): Promise<void> {
  // Hand api-core its Pub/Sub config before any resolver can call publish().
  // Unset GCP_PROJECT_ID → stdout-logging stub.
  // Resolve the event transport before anything can publish; throws under
  // NODE_ENV=production when EVENT_BROKER is missing or non-durable, so a pod
  // that cannot deliver events fails its rollout instead of dropping them
  // silently the way the old `gcpProjectId`-unset stub did.
  console.info('events: transport resolved —', resolveTransport().kind);

  // Bridge the CRM bus (crm.customer.*) + platform bus (order.*) to real
  // Pub/Sub. MUST run before installCrmWebhookFanout() (it wraps the active
  // publisher). No-op when GCP_PROJECT_ID is unset.
  installCrmPubSubBridge({ projectId: env.GCP_PROJECT_ID, logger: console });

  // Wire the in-process CRM consumers so order/quote/etc. mutations made via
  // GraphQL maintain customer stats + activity in THIS process (the platform
  // bus is in-process; events only dispatch where they're published). See the
  // api-rest bootstrap for the full rationale.
  registerCrmConsumers();

  // (Order cancellation is REST-only — api-graphql doesn't cancel orders — so the
  // commerce cancel-restock consumer isn't installed here. It rides in api-rest.)

  // Wrap the CRM publisher so every publishCrmEvent() also enqueues a
  // WebhookDelivery row per matching tenant subscription.
  installCrmWebhookFanout();
  await preconnectWebhookFanout();

  const app = await createApp();

  // Background tick that POSTs pending webhook deliveries to their
  // subscriber URLs with HMAC-SHA256 signatures. Singleton across pods via
  // a Postgres advisory lock — see @sparx/api-core/webhook-delivery.
  // api-rest runs the same loop; the advisory lock makes sure only one
  // pod-of-any-service actually delivers at any given tick.
  const stopWebhookDelivery = startWebhookDeliveryLoop(app.log);

  const shutdown = (signal: NodeJS.Signals): void => {
    app.log.info({ signal }, 'shutdown received');
    stopWebhookDelivery();
    void app
      .close()
      .then(() => {
        process.exit(0);
      })
      .catch((err: unknown) => {
        app.log.error({ err }, 'graceful shutdown failed');
        process.exit(1);
      });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (err) {
    app.log.error({ err }, 'listen failed');
    process.exit(1);
  }
}

void main();
