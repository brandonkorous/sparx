// The public address of ONE SITE (docs/49): the origin every customer-facing link
// api-rest builds is built on. The links in a customer email, a calendar event's
// manage link, a signing link, and the sitemap's `<loc>`s.
//
// The resolution itself lives in `@wizeworks/db/site-origin`, with the full story
// (sparx persona issue 064) and the order it answers in. It moved there because the
// marketplace projection and the channel-sync worker's product feed need the same
// answer and cannot import a service; two answers to one question is how 064
// happened. This module only binds it to api-rest's clients:
//
//   - `resolveSiteOrigin` opens a tenant transaction for the row-level-secured site
//     reads, so a caller with no transaction in hand can still ask;
//   - `canonicalSiteHost` reads the non-RLS `domains` table through the bare client,
//     for the sitemap and the RSS feed, which have the tenant and site already.

import { prisma, withTenant } from '@wizeworks/db';
import {
  canonicalSiteHost as canonicalSiteHostOn,
  resolveSiteOrigin as resolveSiteOriginOn,
  siteUrl,
  type SiteHostInput,
} from '@wizeworks/db/site-origin';

export { siteUrl, type SiteHostInput };

/** The bare canonical host of one site (no scheme). */
export function canonicalSiteHost(input: SiteHostInput): Promise<string> {
  return canonicalSiteHostOn(prisma, input);
}

/**
 * The absolute public origin (`https://host`, no trailing slash) of a site. A null
 * `propertyId`, or one that no longer names a site, means the tenant's primary.
 */
export function resolveSiteOrigin(
  tenantId: string,
  propertyId: string | null | undefined
): Promise<string> {
  return withTenant({ tenantId }, (tx) => resolveSiteOriginOn(tx, tenantId, propertyId));
}
