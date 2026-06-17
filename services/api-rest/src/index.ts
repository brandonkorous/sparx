// Production / dev entrypoint. Boots the Fastify factory and wires up
// graceful shutdown. Tests import ./app.ts directly and skip listen().

import { configurePubsub } from '@sparx/api-core/pubsub';
import { startWebhookDeliveryLoop } from '@sparx/api-core/webhook-delivery';
import { installCrmWebhookFanout, preconnectWebhookFanout, registerCrmConsumers } from '@sparx/crm';
import { installCrmPubSubBridge } from '@sparx/crm/pubsub';
import { registerCommerceConsumers } from '@sparx/commerce/consumers';
import { createApp } from './app.js';
import {
  registerEmailProvisioningConsumer,
  startEmailProvisioningReconcileLoop,
} from './lib/email-provisioning.js';
import { env } from './env.js';
import { startScheduledPublishLoop } from './lib/scheduled-publish.js';
import { startSitebuilderPublishLoop } from './lib/sitebuilder-publish.js';
import { startEmailDispatchLoop } from './lib/email-dispatch.js';
import { attachChatWebsocket } from './websocket/index.js';

async function main(): Promise<void> {
  // Hand api-core its Pub/Sub config before any route handler can call
  // publish(). Unset GCP_PROJECT_ID → stdout-logging stub.
  configurePubsub({ gcpProjectId: env.GCP_PROJECT_ID });

  // Bridge the CRM bus (crm.customer.*) + platform bus (order.*) to real
  // Pub/Sub so the commerce-indexer can keep search live. MUST run before
  // installCrmWebhookFanout() so the fanout wraps the Pub/Sub-backed
  // publisher (not the stub). No-op when GCP_PROJECT_ID is unset (dev).
  installCrmPubSubBridge({ projectId: env.GCP_PROJECT_ID, logger: console });

  // Wire the in-process CRM consumers (order→customer stats + activity, quote,
  // email, segment, module-activation). publishPlatformEvent() is a no-op
  // without subscribers, so without this every order.* event — including
  // orderService.create()'s 'order.created' on checkout — falls on the floor,
  // leaving customers.total_spent/order_count stale (search docs show 0).
  // Subscriptions delegate to the in-memory bus the tee bridge wraps, so
  // ordering vs. installCrmPubSubBridge above doesn't matter.
  registerCrmConsumers();

  // Commerce sell-path consumers on the same in-process bus: order.cancelled →
  // inventory restock (docs/100 §2.4). Kept out of @sparx/crm so CRM stays
  // inventory-agnostic; gated per-tenant on the inventory module.
  registerCommerceConsumers();

  // The Email module's activation consumer (docs/91 §7): on `module.activated`
  // for `email`, materialize the tenant's 13 default Builder-email templates so
  // they're send-ready by KEY. Kept here (not in @sparx/crm) so the CRM package
  // never depends on @sparx/builder; subscribes to the same in-process bus.
  registerEmailProvisioningConsumer();

  // Wrap the CRM publisher so every publishCrmEvent() also enqueues a
  // WebhookDelivery row per matching tenant subscription. Pre-warm the
  // DB connection so the first event doesn't pay startup latency.
  installCrmWebhookFanout();
  await preconnectWebhookFanout();

  const app = await createApp();

  // Background tick that flips entries with status='scheduled' to
  // 'published' once their `scheduled_at` has passed. Singleton across
  // pods via Postgres advisory lock — see lib/scheduled-publish.ts.
  const stopScheduledPublish = startScheduledPublishLoop(app.log);

  // Background tick that publishes Site Builder drafts whose scheduled
  // publish time has passed. Singleton across pods via its own advisory
  // lock — see lib/sitebuilder-publish.ts.
  const stopSitebuilderPublish = startSitebuilderPublishLoop(app.log);

  // Background tick that POSTs pending webhook deliveries to their
  // subscriber URLs with HMAC-SHA256 signatures. Singleton across pods
  // via a separate advisory lock — see @sparx/api-core/webhook-delivery.
  const stopWebhookDelivery = startWebhookDeliveryLoop(app.log);

  // Background tick that publishes `email.send` for due ScheduledSend rows
  // (delayed automation sends + scheduled broadcasts). Singleton across pods
  // via its own advisory lock — see lib/email-dispatch.ts.
  const stopEmailDispatch = startEmailDispatchLoop(app.log);

  // Background pass that back-fills the 13 default Builder-email templates for any
  // email-active tenant that missed `module.activated` (docs/90 §6, docs/91 §7).
  // Singleton across pods via its own advisory lock — see lib/email-provisioning.ts.
  const stopEmailProvisioningReconcile = startEmailProvisioningReconcileLoop(app.log);

  // Live Chat WebSocket server (docs/56, docs/69 A-2). Attaches socket.io to the
  // Fastify HTTP server at /ws/chat; uses the Redis adapter when REDIS_URL is
  // set (multi-replica fan-out) and the in-memory adapter otherwise.
  const chatWs = await attachChatWebsocket(app.server, app.log);

  const shutdown = (signal: NodeJS.Signals): void => {
    app.log.info({ signal }, 'shutdown received');
    stopScheduledPublish();
    stopSitebuilderPublish();
    stopWebhookDelivery();
    stopEmailDispatch();
    stopEmailProvisioningReconcile();
    void chatWs.close().catch((err: unknown) => {
      app.log.error({ err }, 'chat websocket close failed');
    });
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
