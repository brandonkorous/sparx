// WHICH SITE a host names, decided from the host alone.
//
// Split out of lib/site-context so the EDGE can read it. `site-context` reaches
// for `next/headers` and `react`'s `cache`, neither of which exists in the proxy,
// and the proxy needs exactly these three things: the zones this deployment owns,
// how to decode one of our own subdomains, and how to tell a local-dev host from
// a real one.
//
// It also closes a duplicate. `isLocalDevHost` was written twice — once here and
// once in proxy.ts, with a comment in each saying it mirrors the other. Two
// copies of a security gate is the shape where one gets a fix and the other does
// not.
//
// Nothing here makes a network call. Everything here is a pure function of a
// host string, which is why it is safe on the busiest path in the platform.

// Which zones this deployment serves tenant sites for.
//
// Same parsing as api-rest's `OWNED_ZONES`, deliberately: two readers of one
// variable that disagree about its format is its own bug.
const ZONE_LIST = (process.env.SPARX_ZONE_DOMAINS ?? process.env.SPARX_ZONE_DOMAIN ?? 'sparx.zone')
  .split(',')
  .map((zone) => zone.trim().toLowerCase())
  .filter((zone) => zone.length > 0);

/** Every zone this deployment serves tenant sites for, in declaration order. */
export const OWNED_ZONES: readonly string[] = ZONE_LIST.length > 0 ? ZONE_LIST : ['sparx.zone'];

/** The site a request routes to: which TENANT and which of its web PROPERTIES
 *  (sites). `propertySlug` is null for the tenant's primary site (api-rest then
 *  defaults to it), so single-site tenants need no property at all. */
export interface SiteRoute {
  tenantSlug: string;
  propertySlug: string | null;
  /**
   * The zone this route was decoded from, when it came from a zone host.
   *
   * Null for a custom domain and for the dev override, because neither carries
   * a brand claim: a custom domain is matched EXACTLY against the domains table,
   * which is itself the proof of ownership.
   *
   * Present, it is a claim that has to be CHECKED — see `resolveSite`. A zone
   * host is self-describing about the tenant and says nothing true about the
   * brand, so on its own it would let either brand's zone serve either brand's
   * tenant.
   */
  zone: string | null;
}

/** Decode one of OUR `*.sparx.zone` subdomains into its tenant + property.
 *
 *  These hosts are SELF-DESCRIBING — api-rest's `mintZoneHost` encodes the tenant
 *  (and property) directly in the hostname — so we resolve them from the host
 *  alone, with no API round-trip. That makes zone hosts immune to a stale or
 *  unreachable `site-by-host` lookup (the domains table is just a mirror of this
 *  deterministic minting). Custom domains, whose mapping is arbitrary, return null
 *  here and fall through to the domains table.
 *
 *    `<tenant>.<zone>`            → primary site            (propertySlug null)
 *    `<property>.<tenant>.<zone>` → that tenant's named site
 *
 *  ...for EVERY zone this deployment owns — `sparx.zone` and `piggles.site`
 *  today. The zone is matched first and stripped, so the label decoding below is
 *  identical whichever brand the host belongs to.
 *
 *  A legacy flat `<tenant>-<property>` host is a single label here, so it decodes
 *  as a (usually non-existent) tenant slug and 404s — deprecated in favour of the
 *  dotted form (migration 20260707000000); the dotted host is now canonical. */
export function zoneSiteRoute(host: string | null | undefined): SiteRoute | null {
  if (!host) return null;
  const noPort = host.split(':')[0]?.toLowerCase();
  if (!noPort) return null;
  // Which of our zones is this host in? A host in none of them is a custom
  // domain and belongs to the domains table, whose mapping is arbitrary.
  const zone = OWNED_ZONES.find((z) => noPort === z || noPort.endsWith(`.${z}`));
  if (!zone || noPort === zone) return null;
  const labels = noPort.slice(0, -`.${zone}`.length).split('.');
  if (labels.length === 1 && labels[0]) {
    return { tenantSlug: labels[0], propertySlug: null, zone };
  }
  if (labels.length === 2 && labels[0] && labels[1]) {
    return { tenantSlug: labels[1], propertySlug: labels[0], zone };
  }
  // Three+ labels aren't a shape we mint.
  return null;
}

/**
 * Hosts with no per-tenant DNS — the ONLY place the dev `?tenant=`/`?property=`
 * override may steer site selection.
 *
 * Every production host (a real `*.sparx.zone` subdomain or a connected custom
 * domain) carries the site in the Host header, so it must resolve by Host alone
 * and never trust those cookies. Port-tolerant, because local dev runs on one.
 */
export function isLocalDevHost(host: string): boolean {
  const h = host.split(':')[0]?.toLowerCase() ?? '';
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.endsWith('.localhost')
  );
}
