// `site.updated`: tell the website its owner just changed something it shows.
//
// WHAT WAS MISSING (sparx persona issue 040). A site's name, links, contact
// details, brand, cookie banner, shop settings and footer legal links are live
// the moment the owner saves, and the website serves every one of them out of a
// cached read: the business payload is held for 300 seconds. The purge existed
// on the site (POST /api/revalidate) and in a worker that mapped events onto it,
// but none of these saves published anything and the worker ran nowhere. A
// cookie-banner save was measured reaching the live site 68 seconds later, with
// nothing on the screen to say it had not.
//
// BEST-EFFORT, AFTER THE WRITE. `publish` swallows broker failures and every
// caller awaits it only once its write has committed. A broker hiccup must never
// fail a save that succeeded; the worst case is the old wait for the cache.

import type { FastifyBaseLogger } from 'fastify';
import { publish } from '@wizeworks/api-core/pubsub';
import type { SiteUpdatedPayload } from '@wizeworks/events';

/**
 * Announce that a site's own settings changed.
 *
 * `propertyId` null means the change is tenant-wide and every site inherits it
 * (the tenant brand, the payment method). `changed` names what moved in the
 * owner's terms, for the logs: it never decides what is purged.
 */
export async function publishSiteUpdated(
  logger: FastifyBaseLogger,
  tenantId: string,
  actorId: string | null,
  payload: SiteUpdatedPayload
): Promise<void> {
  if (payload.changed.length === 0) return;
  await publish(logger, 'site.updated', tenantId, actorId, { ...payload });
}
