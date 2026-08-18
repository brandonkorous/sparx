// Site-publish events — the purge signal the storefront's cache has been waiting for.
//
// WHAT WAS MISSING. `cache-revalidation-worker` already maps `builder.*` onto the
// `builder:<slug>` tag, and every storefront page/layout/frame/style read already
// carries that tag. The one thing absent was a PUBLISHER: nothing anywhere emitted a
// `builder.*` event, so the branch was dead code and the tag was never purged.
//
// That is harmless today and only today, because all 19 storefront routes are
// `force-dynamic` — nothing is cached, so nothing needs invalidating. It stops being
// harmless the moment ISR is switched on (roadmap slice 21): a publish would show
// nothing until the cache aged out, and a ROLLBACK would leave the broken page live,
// which is precisely the failure a rollback exists to undo. Shipping the publisher
// first is what turns that slice from a rewrite into a switch.
//
// BEST-EFFORT, ALWAYS. `publishEvent` swallows its own failures, and every caller here
// awaits it AFTER the publish has already committed. A Pub/Sub hiccup must never fail a
// publish that succeeded — the worst case is a stale cache, which the next publish or
// the revalidate window clears.

import {
  createPublisher,
  publishEvent,
  type EventType,
  type PublisherLogger,
} from '@wizeworks/events';

const logger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};

const publisher = createPublisher({ logger });

/** What a builder publish/rollback carries. The worker only needs the tenant (it
 *  purges by slug), so the rest is for anything downstream that wants to know WHICH
 *  site moved and to what — a second site's publish must not read as the first's. */
export interface BuilderPublishPayload extends Record<string, unknown> {
  propertyId: string;
  releaseId: string;
  /** Present on a publish; a rollback names the release it restored FROM instead. */
  hash?: string;
}

export async function publishBuilderEvent(
  type: Extract<EventType, 'builder.published' | 'builder.rolled_back'>,
  tenantId: string,
  actorId: string | null,
  data: BuilderPublishPayload
): Promise<void> {
  await publishEvent(publisher, type, tenantId, actorId, data, logger);
}
