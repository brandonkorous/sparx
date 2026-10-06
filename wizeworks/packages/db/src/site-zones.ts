// The zones this deployment serves sites on, and the free host a site is minted in
// (docs/49 §5). Moved here from api-rest's `lib/domain.ts` so that everything that
// names a site's public address (api-rest's mailers and sitemap, the marketplace
// projection in @wizeworks/commerce, the channel-sync worker's product feed, the
// MCP domain tools) asks ONE implementation. api-rest re-exports every name here,
// so its existing call sites are unchanged (sparx persona issue 064).
//
// NOTHING IN THIS FILE OPENS A DATABASE CONNECTION. The one read, `tenantZone`, takes
// the client to read through as an argument: a caller inside a tenant transaction
// passes its `tx`, api-rest passes its bare `prisma`. That keeps the module safe to
// import anywhere and keeps every caller's own test doubles in charge of the data.
//
// ── THE ZONES WE OWN ────────────────────────────────────────────────────────
//
// More than one, because more than one BRAND is served by this process. A sparx
// tenant lives on `<slug>.sparx.zone`; a Piggles tenant lives on
// `<slug>.piggles.site` (piggles/CLAUDE.md, "The three surfaces").
//
// `SPARX_ZONE_DOMAINS` is a comma-separated list; the first entry is the
// DEFAULT, the zone anything that does not say otherwise is minted in. The old
// singular `SPARX_ZONE_DOMAIN` still works and means a one-entry list, so no
// existing deployment changes behavior.
//
// WHY A LIST IS THE RIGHT SHAPE HERE, when `provisionTenant` deliberately made
// the zone a PARAMETER instead. The two questions are different. "Which zone
// does this NEW tenant get?" varies per request and can never come from the
// environment, which is why signup takes an argument. "Which zones does this
// deployment own?" is a fact about the deployment, identical for every request,
// and a list is exactly what it is.

import type { TxClient } from './tenant-context';

const ZONE_LIST = (process.env.SPARX_ZONE_DOMAINS ?? process.env.SPARX_ZONE_DOMAIN ?? 'sparx.zone')
  .split(',')
  .map((zone) => zone.trim().toLowerCase())
  .filter((zone) => zone.length > 0);

/** Every zone this deployment owns, in declaration order. */
export const OWNED_ZONES: readonly string[] = ZONE_LIST.length > 0 ? ZONE_LIST : ['sparx.zone'];

/** The default zone: what a caller that names no zone gets. */
export const SPARX_ZONE = OWNED_ZONES[0]!;

// A conservative hostname check: dot-separated labels, each 1-63 chars of
// [a-z0-9-] not edge-hyphenated, 2+ labels, 253 total at most. Rejects schemes,
// paths, ports, and wildcards before anything touches the DB.
const HOST_RE =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Lowercase + strip scheme, path, port, and a trailing dot. Returns '' for junk.
 *  Use before validating or persisting any user-supplied host. */
export function normalizeHost(raw: string): string {
  let h = raw.trim().toLowerCase();
  h = h.replace(/^[a-z]+:\/\//, ''); // strip scheme
  h = h.split('/')[0] ?? ''; // strip path
  h = h.split(':')[0] ?? ''; // strip port
  h = h.replace(/\.$/, ''); // strip FQDN trailing dot
  return h;
}

export function isValidHost(host: string): boolean {
  return HOST_RE.test(host);
}

/**
 * Which zone a caller that named one actually gets.
 *
 * IT ACCEPTS ANY WELL-FORMED ZONE, and deliberately does NOT require membership
 * of `OWNED_ZONES`. That membership test is what issue 316 was really filed on.
 * `SPARX_ZONE_DOMAINS` is an environment variable, so it can be (and locally is)
 * SHORT of a zone this deployment is genuinely serving; signup does not consult
 * it at all (`provisionTenant` mints from the brand's own zone), so a Piggles
 * business already living on `piggles.site` had its zone read back correctly by
 * `tenantZone` and then DISCARDED here, and its second site was minted on
 * `sparx.zone`. Two gates, and fixing only the first fixed nothing.
 *
 * What makes this safe is where the argument comes from. Every caller that names
 * a zone passes `await tenantZone(db, tenantId)`, which reads it off a host the
 * platform minted itself, so the zone is one we are already serving that tenant
 * on, by construction. The shape check is the honest guard: it rejects junk
 * without pretending an env var knows the answer.
 */
export function zoneToUse(zoneDomain?: string | null): string {
  const zone = normalizeHost(zoneDomain ?? '');
  return zone && isValidHost(zone) ? zone : SPARX_ZONE;
}

/** Which owned zone `host` sits in, or null if it sits in none of them.
 *
 *  This is how a caller works out a tenant's zone WITHOUT branching on its
 *  brand: read the host the tenant already has and ask which zone it belongs to.
 *  A `if (brand === 'piggles')` in a shared service is the fork RULE #0 exists to
 *  prevent, and it would also be wrong the day a third brand appears. */
export function zoneOf(host: string): string | null {
  return OWNED_ZONES.find((zone) => host === zone || host.endsWith(`.${zone}`)) ?? null;
}

/** The always-on subdomain for a property: the primary keeps the bare
 *  `<tenant>.sparx.zone` (backward-compatible with the pre-multi-site host the
 *  Caddy endpoint already authorized); additional sites get the HIERARCHICAL
 *  `<property>.<tenant>.sparx.zone`. Both are globally unique because tenant
 *  slugs are unique and property slugs are unique within a tenant.
 *
 *  Why hierarchical (not the old flat `<tenant>-<property>` join): the flat form
 *  is AMBIGUOUS. `korous-store-brandonkorous` can't be split back into tenant +
 *  property without a DB lookup (both slugs may contain hyphens), so a resolver
 *  that loses the `domains`-table answer mis-reads the whole label as one tenant
 *  and 404s a live site. `<property>.<tenant>` splits cleanly on the first dot.
 *
 *  DNS: needs no per-tenant record. `<tenant>.sparx.zone` is itself only a
 *  `*.sparx.zone` wildcard match (not a real zone node), so by wildcard
 *  closest-encloser synthesis the same wildcard also covers
 *  `<property>.<tenant>.sparx.zone`. The one rule that keeps this working: never
 *  add an explicit `<tenant>.sparx.zone` DNS node.
 *
 *  TLS is per-host and on-demand: Caddy holds the ACME account and issues a
 *  certificate for each hostname on first request, at ANY depth, so the
 *  two-label name needs nothing extra.
 *
 *  NEVER PUT AN EDGE-TERMINATING PROXY IN FRONT OF THIS. Behind the
 *  Cloudflare Tunnel, TLS terminated at Cloudflare's edge, Caddy held no
 *  certificate at all, and every host depended instead on Universal SSL,
 *  whose SANs are exactly `sparx.zone` and `*.sparx.zone`. A wildcard matches
 *  ONE label (RFC 6125 §6.4.3), so it covered `<tenant>.sparx.zone` and NOT
 *  `<property>.<tenant>.sparx.zone`: the edge had no certificate for the longer
 *  name and answered the ClientHello with handshake_failure (alert 40). Every
 *  non-primary site of every multi-site tenant was unreachable over HTTPS, and
 *  it presented as a browser SSL error rather than a 404, which is why it read
 *  like a certificate problem rather than a routing one. Ingress is a
 *  `Service type=LoadBalancer` (`k8s/ingress`) precisely so that cannot recur:
 *  the tunnel had no inbound path, so Caddy could never complete an ACME
 *  challenge behind it. `*.sparx.zone` must stay DNS-only for the same reason.
 *
 *  `zoneDomain` names which owned zone to mint in, and defaults to the first,
 *  so every existing caller is unchanged. A caller that has a tenant should pass
 *  `await tenantZone(db, tenantId)`: minting a SECOND site for a Piggles business
 *  under the default zone would give one business two sites in two different
 *  brands' zones, and the second one would be `<prop>.<tenant>.sparx.zone` on a
 *  console that never mentions sparx.
 *
 *  The zone is taken as given once it is well-formed. See `zoneToUse` for why
 *  requiring it to be in `OWNED_ZONES` is the wrong test, and how that second
 *  check went on minting `sparx.zone` hosts for Piggles businesses even after
 *  `tenantZone` started answering correctly (issue 316). */
export function mintZoneHost(
  tenantSlug: string,
  propertySlug: string,
  isPrimary: boolean,
  zoneDomain?: string | null
): string {
  const zone = zoneToUse(zoneDomain);
  const suffix = `.${zone}`;
  return isPrimary ? `${tenantSlug}${suffix}` : `${propertySlug}.${tenantSlug}${suffix}`;
}

/** The zone out of a host the platform minted itself. Every `type: 'subdomain'` row is
 *  one, so its last two labels ARE the zone: this reads back what provisioning wrote
 *  rather than trusting anything a tenant typed. It is what answers when
 *  `SPARX_ZONE_DOMAINS` is short of a zone this deployment is really serving.
 *
 *  Exported because the cross-brand repair asks the same question of the same rows,
 *  and two readings of "which zone is this host in" is how one of them drifts. */
export function mintedZoneOf(host: string): string | null {
  const labels = host.split('.');
  return labels.length >= 3 ? labels.slice(-2).join('.') : null;
}

/** What `tenantZone` reads through: the bare client or a tenant transaction. */
export type DomainReader = Pick<TxClient, 'domain'>;

/**
 * The zone a tenant's sites live in, read off the subdomain it already has.
 *
 * Derived, never branched on: provisioning recorded the answer at signup when it
 * created `<slug>.<zoneDomain>`, so the honest way to find it later is to look at
 * that row rather than to re-decide it from the tenant's brand. It also means a
 * third brand needs no change here at all.
 *
 * Falls back to the default zone when the tenant has no subdomain row, which is
 * every pre-multi-zone tenant, and is exactly right for them.
 *
 * NOT the same as falling back when `OWNED_ZONES` has not been told about the
 * tenant's zone. That happens whenever `SPARX_ZONE_DOMAINS` is short of a zone this
 * deployment is actually serving: the local stack sets neither variable, so the list
 * is `['sparx.zone']` and every Piggles tenant's `piggles.site` row goes unrecognized.
 * The old fallback then handed that tenant's second site `<site>.<tenant>.sparx.zone`:
 * one business with two sites in two brands' zones, the second named after a product
 * it has never heard of, which is the exact outcome the caller's comment says this
 * function exists to prevent. Reading the zone off the HOST closes it: the tenant is
 * already being served there, so it is the one answer that cannot be wrong, and it
 * stops a missing config entry from silently crossing the brand boundary.
 */
export async function tenantZone(db: DomainReader, tenantId: string): Promise<string> {
  const rows = await db.domain.findMany({
    where: { tenantId, type: 'subdomain' },
    select: { host: true, property: { select: { isPrimary: true } } },
    orderBy: { createdAt: 'asc' },
  });
  // THE PRIMARY SITE'S SUBDOMAIN FIRST, and the order matters. That row is the one
  // provisioning minted at signup, so it is the tenant's zone by definition; any other
  // is a row some later code path chose, and if that path ever chose wrong, reading it
  // back would make one mistake permanent for every site the tenant adds afterwards.
  const ordered = [...rows].sort(
    (a, b) => Number(b.property?.isPrimary ?? false) - Number(a.property?.isPrimary ?? false)
  );
  for (const row of ordered) {
    // Resolved per ROW rather than in two passes over all of them. A pass that tried
    // `zoneOf` everywhere first would skip past the primary site's unrecognized zone
    // and settle on a later row's recognized one, which is precisely how one wrong
    // host becomes every subsequent site's host.
    const zone = zoneOf(row.host) ?? mintedZoneOf(row.host);
    if (zone) return zone;
  }
  return SPARX_ZONE;
}
