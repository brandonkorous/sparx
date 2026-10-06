// cache-revalidation-worker: purge a website's cached reads when its owner
// changes something.
//
// A LIBRARY, registered by services/event-worker. It was written as a Cloud Run
// push service (an HTTP server decoding a Pub/Sub envelope and an OIDC claim)
// and never deployed anywhere: no Cloud Run service, no k8s manifest, no entry in
// the release. So the site's cache tags were never purged by anything, and every
// owner change reached visitors only when the cache aged out. Measured
// 2026-10-01: a cookie-banner save took 68 seconds to appear on the live site,
// and the business payload it rides in is cached for 300 (sparx persona issue
// 040). `handler.ts` and its tests came across unchanged in what they decide;
// the HTTP entrypoint is gone.
//
// `DURABLE` is JetStream's cursor key and is permanent once shipped. It keeps
// the service's name, which no consumer ever used, so there is no cursor to
// carry over: the first boot creates it fresh.

import type { Logger } from 'pino';
import { createBrokerHandler, type WorkerSubscription } from '@wizeworks/events';

import { env } from './env.js';
import { handle, parseEvent } from './handler.js';

export const DURABLE = 'cache-revalidation-worker';

/**
 * What arrives. Real `EventType` names only (`pnpm check:worker-events`), and
 * only events that change something a VISITOR reads. A prefix in
 * `planRevalidation` would match far more: `inventory.*` alone covers pick
 * lists, transfers between shelves, late purchase orders and nightly ABC
 * re-ranking, none of which a shopper can see, and each would have cost the
 * business a full commerce purge. `test/handler.test.ts` asserts every name here
 * maps to a scope, so a name that maps to nothing cannot sit in this list
 * looking like coverage.
 */
export const EVENTS = [
  // ── The business payload: name, logo, socials, cookie banner, billing phase ─
  'tenant.updated',
  'tenant.subscription.changed',
  'site.updated',
  'template.installed',
  'module.activated',
  'module.deactivated',
  // ── Published site pages and chrome ─────────────────────────────────────────
  'builder.published',
  'builder.rolled_back',
  // ── Catalog ─────────────────────────────────────────────────────────────────
  'product.created',
  'product.updated',
  'product.published',
  'product.deleted',
  'variant.created',
  'variant.updated',
  'variant.deleted',
  'price.recomputed',
  // Stock a shopper can see ("Only 3 left", "Sold out"). The four after
  // `depleted` move on-hand quantities WITHOUT also publishing
  // `inventory.adjusted`, so they are listed in their own right.
  'inventory.adjusted',
  'inventory.low',
  'inventory.depleted',
  'inventory.count.completed',
  'inventory.transfer.shipped',
  'inventory.transfer.received',
  'inventory.assembly.completed',
  'inventory.source.sync_completed',
  // Reviews and questions on a product page. `review.flagged` takes an approved
  // review OFF the page; `review.submitted` is still waiting for moderation.
  'review.published',
  'review.flagged',
  'question.published',
  'question.answered',
  // ── Content, the footer's legal links, redirects ────────────────────────────
  'content.entry.created',
  'content.entry.updated',
  'content.entry.published',
  'content.entry.unpublished',
  'content.entry.deleted',
  'content_type.upserted',
  'redirect.added',
  'redirect.changed',
  'redirect.removed',
];

export function createSubscription(logger: Logger): WorkerSubscription {
  // Said once, at boot, in the fleet's own log. Every purge will also throw and
  // be retried, but a line here is what someone reading a fresh rollout sees.
  if (!env.SPARX_REVALIDATE_SECRET) {
    logger.error(
      { url: env.SITE_REVALIDATE_URL },
      'SPARX_REVALIDATE_SECRET is not set: every site cache purge will fail and be retried, ' +
        'and owners will wait for the cache to expire'
    );
  }
  return {
    durable: DURABLE,
    events: EVENTS,
    handle: createBrokerHandler({ name: DURABLE, logger, parseEvent, handle }),
  };
}
