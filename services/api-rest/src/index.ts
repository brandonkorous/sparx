// Production / dev entrypoint. Boots the Fastify factory and wires up
// graceful shutdown. Tests import ./app.ts directly and skip listen().

import { resolveTransport } from '@sparx/events';
import { startWebhookDeliveryLoop } from '@sparx/api-core/webhook-delivery';
import { installCrmWebhookFanout, preconnectWebhookFanout, registerCrmConsumers } from '@sparx/crm';
import { installCrmPubSubBridge } from '@sparx/crm/pubsub';
import { installBuilderPubSubBridge } from '@sparx/builder/pubsub';
import { registerCommerceConsumers } from '@sparx/commerce/consumers';
import { createApp } from './app.js';
import {
  registerEmailProvisioningConsumer,
  startEmailProvisioningReconcileLoop,
} from './lib/email-provisioning.js';
import {
  registerModuleProvisioningConsumer,
  startModuleProvisioningReconcileLoop,
} from './lib/module-provisioning.js';
import { env } from './env.js';
import { startScheduledPublishLoop } from './lib/scheduled-publish.js';
import { startSocialScheduledLoop } from './lib/social-scheduled.js';
import { startSocialSweepLoops } from './lib/social-sweeps.js';
import { startSocialSlotFillLoop } from './lib/social-slot-fill.js';
import { startSitebuilderPublishLoop } from './lib/sitebuilder-publish.js';
import { startEmailDispatchLoop } from './lib/email-dispatch.js';
import { startBookingNotificationLoop } from './lib/scheduling-notifications.js';
import { startCalendarSyncLoop } from './lib/scheduling-calendar-sync.js';
import { startSeriesMaterializationLoop } from './lib/scheduling-series.js';
import { startWaitlistLoop } from './lib/scheduling-waitlist.js';
import { attachChatWebsocket } from './websocket/index.js';
import { attachBuilderWebsocket } from './websocket/builder-index.js';

async function main(): Promise<void> {
  // Resolve the event transport BEFORE anything can publish. This throws on a
  // missing or unusable `EVENT_BROKER` under NODE_ENV=production, so a pod that
  // cannot deliver events fails its rollout instead of serving traffic while
  // dropping them.
  //
  // It replaced `configurePubsub({ gcpProjectId: env.GCP_PROJECT_ID })`, which
  // did the opposite: an unset project id was read as "use the stub", so the
  // GCP→Azure migration quietly turned every publish into a no-op that reported
  // success. Nothing here needs a cloud's project id any more — @sparx/events
  // owns that, and only the pubsub adapter ever sees it.
  console.info('events: transport resolved —', resolveTransport().kind);

  // Bridge the CRM bus (crm.customer.*) + platform bus (order.*) to real
  // Pub/Sub so the commerce-indexer can keep search live. MUST run before
  // installCrmWebhookFanout() so the fanout wraps the Pub/Sub-backed
  // publisher (not the stub). No-op when GCP_PROJECT_ID is unset (dev).
  installCrmPubSubBridge({ projectId: env.GCP_PROJECT_ID, logger: console });

  // Same bridge for builder.* publishes (docs/127 §6). Until this existed every
  // builder event went to console.log and stopped, which is why the storefront's
  // builder + silica reads are `cache: 'no-store'` — there was no purge to trigger,
  // so a TTL would only have served stale pages. With the bridge installed,
  // cache-revalidation-worker maps builder.* → the `builder` scope and the storefront
  // can cache again. No-op when GCP_PROJECT_ID is unset (dev).
  installBuilderPubSubBridge({ projectId: env.GCP_PROJECT_ID, logger: console });

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

  // The remaining module activation defaults (docs/104 §5.A): on `module.activated`
  // for commerce / inventory / b2b / chat, seed each module's template-agnostic
  // defaults (commerce site settings + fallback shipping, a default warehouse,
  // a default inactive B2B approval rule, a chat quick-reply bank). Kept here, not
  // in any one domain package, so the dependency graph stays acyclic; subscribes
  // to the same in-process bus.
  registerModuleProvisioningConsumer();

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

  // Background tick that flips due `scheduled` social posts to `publishing` and
  // emits `social.post.due` for the social-worker to drain (docs/133 §7). Singleton
  // across pods via its own advisory lock — see lib/social-scheduled.ts.
  const stopSocialScheduled = startSocialScheduledLoop(app.log);

  // The rest of the social module's background work, on four separate clocks: grant
  // health (so a dead account says "reconnect" before a post is lost), post-metrics
  // refresh, the engagement-inbox poll, and the per-destination scheduled drain. Each is
  // a singleton across pods via its own advisory lock — see lib/social-sweeps.ts.
  const stopSocialSweeps = startSocialSweepLoops(app.log);

  // Background tick that fills empty auto-fill posting slots from the evergreen pool,
  // so a planned cadence doesn't go quiet — see lib/social-slot-fill.ts.
  const stopSocialSlotFill = startSocialSlotFillLoop(app.log);

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

  // Background tick that sends due booking notifications (confirmations,
  // reminders, change/cancellation notices) over email + SMS from the
  // scheduling_booking_notifications ledger. Singleton across pods via its own
  // advisory lock — see lib/scheduling-notifications.ts (docs/79 §10).
  const stopBookingNotifications = startBookingNotificationLoop(app.log);

  // Background tick that refreshes inbound calendar feeds (Layer 2, docs/79 §8.2):
  // re-fetches each due ical_feed connection and replaces its external_busy_blocks.
  // Singleton across pods via its own advisory lock — see lib/scheduling-calendar-sync.ts.
  const stopCalendarSync = startCalendarSyncLoop(app.log);

  // Background tick that rolls recurring booking-series horizons forward,
  // materializing new child bookings as time passes (docs/79 §7.6). Singleton
  // across pods via its own advisory lock — see lib/scheduling-series.ts.
  const stopSeriesMaterialization = startSeriesMaterializationLoop(app.log);

  // Background tick that auto-offers freed slots to waiting customers + expires
  // stale offers (docs/79 §7). Singleton via its own advisory lock — see
  // lib/scheduling-waitlist.ts.
  const stopWaitlist = startWaitlistLoop(app.log);

  // Background pass that back-fills the 13 default Builder-email templates for any
  // email-active tenant that missed `module.activated` (docs/90 §6, docs/91 §7).
  // Singleton across pods via its own advisory lock — see lib/email-provisioning.ts.
  const stopEmailProvisioningReconcile = startEmailProvisioningReconcileLoop(app.log);

  // Background pass that back-fills the commerce/inventory/b2b/chat activation
  // defaults for any tenant that missed `module.activated` (docs/104 §5.A).
  // Singleton across pods via its own advisory lock — see lib/module-provisioning.ts.
  const stopModuleProvisioningReconcile = startModuleProvisioningReconcileLoop(app.log);

  // Live Chat WebSocket server (docs/56, docs/69 A-2). Attaches socket.io to the
  // Fastify HTTP server at /ws/chat; uses the Redis adapter when REDIS_URL is
  // set (multi-replica fan-out) and the in-memory adapter otherwise.
  const chatWs = await attachChatWebsocket(app.server, app.log);

  // Builder collaboration WebSocket (docs/126 Phase 4). A second socket.io server at
  // /ws/builder — relays persisted ops to co-editors and carries presence. Same Redis
  // fan-out story as chat.
  const builderWs = await attachBuilderWebsocket(app.server, app.log);

  const shutdown = (signal: NodeJS.Signals): void => {
    app.log.info({ signal }, 'shutdown received');
    stopScheduledPublish();
    stopSocialScheduled();
    stopSocialSweeps();
    stopSocialSlotFill();
    stopSitebuilderPublish();
    stopWebhookDelivery();
    stopEmailDispatch();
    stopBookingNotifications();
    stopCalendarSync();
    stopSeriesMaterialization();
    stopWaitlist();
    stopEmailProvisioningReconcile();
    stopModuleProvisioningReconcile();
    void chatWs.close().catch((err: unknown) => {
      app.log.error({ err }, 'chat websocket close failed');
    });
    void builderWs.close().catch((err: unknown) => {
      app.log.error({ err }, 'builder websocket close failed');
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
