// The public address of ONE SITE (docs/49): the origin every customer-facing link
// is built on. The links in a customer email, a calendar event's manage link, a
// signing link, the sitemap's `<loc>`s, the marketplace's "Visit their store", and
// the product page a sales channel (Google Shopping, Faire, ...) sends its shoppers to.
//
// ── WHY THIS IS ONE FUNCTION, AND WHY IT LIVES IN THE DATA PACKAGE ──────────
//
// The sitemap worked this out properly from the day sites had their own domains.
// Every mailer instead read `SPARX_SITE_BASE`, a setting nothing sets (not the
// cluster files, not the deploy workflows, not dev), and when it was unset they
// returned the bare PATH. So every link in every customer email on every shop was
// `/account/orders`: something that goes nowhere from an inbox, while the sitemap a
// few files away knew the real address the whole time (sparx persona issue 064).
//
// The same unset setting also switched off two things outside api-rest: the
// marketplace's "Visit their store" link (`market_listings.product_url`, always
// null) and the product feed to every sales channel (no absolute product URL, so
// the channel-sync worker skipped the push). They could not import api-rest's
// helper, so the helper moved here, below all of them. Two answers to one question
// is how 064 happened, so there is one, and no caller can fall back to a path:
// `resolveSiteOrigin` always returns an absolute origin.
//
// ── THE ORDER ───────────────────────────────────────────────────────────────
//
//   1. the site's canonical domain row, verified or live: a connected custom
//      domain once it works, or the free subdomain minted at signup;
//   2. the tenant's `settings.primaryDomain`, for the PRIMARY site only (it is a
//      tenant-level setting and predates multi-site, so it can only describe the
//      site it was set for);
//   3. the minted subdomain, in the zone the tenant is actually served from
//      (`tenantZone`), never a guessed one: a Piggles business's second site is
//      `<site>.<tenant>.piggles.site`, not a `sparx.zone` host it has never heard of.
//
// `SPARX_SITE_BASE`, when set, is an explicit override (local dev points it at the
// storefront on localhost). It names one host per tenant, so it cannot tell two
// sites apart, which is why it is an override and not the answer.
//
// Like `./site-zones`, nothing here opens a connection: every read goes through the
// client the caller passes, so a caller inside a tenant transaction reuses it.

import type { TxClient } from './tenant-context';
import { mintZoneHost, tenantZone, type DomainReader } from './site-zones';

export {
  OWNED_ZONES,
  SPARX_ZONE,
  normalizeHost,
  isValidHost,
  zoneToUse,
  zoneOf,
  mintZoneHost,
  mintedZoneOf,
  tenantZone,
  type DomainReader,
} from './site-zones';

/** What `resolveSiteOrigin` reads through: a TENANT transaction (`withTenant`'s
 *  `tx`), because the site rows are row-level secured. */
export type SiteReader = Pick<TxClient, 'tenant' | 'property' | 'domain'>;

/** The site whose host is being asked for, as the caller already has it. */
export interface SiteHostInput {
  tenantId: string;
  tenantSlug: string;
  /** `tenants.settings`, read for the legacy `primaryDomain` only. */
  tenantSettings: unknown;
  property: { id: string; slug: string; isPrimary: boolean } | null;
}

function primaryDomainSetting(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object') return null;
  const value = (settings as Record<string, unknown>).primaryDomain;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * The bare canonical host of one site (no scheme): the sitemap's `<loc>` base and
 * the host every customer link is built on. See the file header for the order.
 * `domains` is a non-RLS dispatch table, so the bare client reads it as well as a
 * tenant transaction does.
 */
export async function canonicalSiteHost(db: DomainReader, input: SiteHostInput): Promise<string> {
  const { tenantId, tenantSlug, property } = input;
  if (property) {
    const canonical = await db.domain.findFirst({
      where: {
        propertyId: property.id,
        isCanonical: true,
        status: { in: ['verified', 'active'] },
      },
      select: { host: true },
    });
    if (canonical?.host) return canonical.host;
  }
  const isPrimary = property?.isPrimary ?? true;
  const setting = isPrimary ? primaryDomainSetting(input.tenantSettings) : null;
  if (setting) return setting;
  return mintZoneHost(
    tenantSlug,
    property?.slug ?? 'primary',
    isPrimary,
    await tenantZone(db, tenantId)
  );
}

/** The explicit override, `{slug}` substituted, trailing slash dropped. Read per
 *  call (not at module load) so a test can set it. */
function siteBaseOverride(tenantSlug: string): string | null {
  const base = process.env.SPARX_SITE_BASE?.trim();
  if (!base) return null;
  return base.replace('{slug}', tenantSlug).replace(/\/+$/, '');
}

/**
 * The absolute public origin (`https://host`, no trailing slash) of a site. A null
 * `propertyId` means the tenant's primary site; so does an id that no longer names
 * a site (a deleted site's orders keep a null, not a dangling id, but a stale
 * caller should still get a working link rather than an error).
 *
 * `tx` must be scoped to `tenantId` (`withTenant({ tenantId }, (tx) => ...)`).
 * Throws when the tenant itself does not exist: there is no truthful host to build,
 * and a link to `https://.sparx.zone` is the bare path's failure in a new shape.
 */
export async function resolveSiteOrigin(
  tx: SiteReader,
  tenantId: string,
  propertyId: string | null | undefined
): Promise<string> {
  const tenant = await tx.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true, settings: true },
  });
  if (!tenant?.slug) throw new Error(`No tenant ${tenantId}; cannot build a site address`);
  const override = siteBaseOverride(tenant.slug);
  if (override) return override;

  const select = { id: true, slug: true, isPrimary: true } as const;
  const property =
    (propertyId ? await tx.property.findUnique({ where: { id: propertyId }, select }) : null) ??
    (await tx.property.findFirst({ where: { isPrimary: true }, select }));
  const host = await canonicalSiteHost(tx, {
    tenantId,
    tenantSlug: tenant.slug,
    tenantSettings: tenant.settings ?? null,
    property,
  });
  return `https://${host}`;
}

/** A path on a site, as an absolute URL. `path` is site-relative (`/account`);
 *  an empty path is the site's home, which is the origin with a trailing slash so
 *  a mail client never has to guess. */
export function siteUrl(origin: string, path: string): string {
  if (path === '' || path === '/') return `${origin}/`;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Which site a site-scoped row (a product, under docs/49 §3 Model B) is actually
 * shown on, so a link to it opens a page rather than another site's 404.
 *
 * `linkedSiteIds` is the row's site links; none means "every site". `preferred` is
 * the site the caller is speaking for (the marketed site, a channel's site): it
 * wins whenever the row is visible there. A row scoped only to OTHER sites gets
 * its own first site. `null` means "the tenant's primary", which is what
 * `resolveSiteOrigin` does with it.
 */
export function siteShowingRow(
  linkedSiteIds: readonly string[],
  preferred: string | null | undefined
): string | null {
  if (linkedSiteIds.length === 0) return preferred ?? null;
  if (preferred && linkedSiteIds.includes(preferred)) return preferred;
  return linkedSiteIds[0] ?? null;
}
