// Domain helpers (docs/49 §5, docs/24) — host normalization, the always-on
// `*.sparx.zone` subdomain minting, BYO-domain DNS verification, and the
// host→property resolution that powers both the storefront (wizeworks/apps/site) and the
// Caddy on-demand-TLS ask endpoint.
//
// `domains` is a NON-RLS dispatch table (like `tenants`): resolution runs BEFORE
// any tenant is known, so these reads go through the bare `prisma` client, never
// withTenant. `host` is globally unique — that uniqueness is the cross-tenant
// guard (a host can't be claimed by two tenants). Management writes (in
// routes/v1/domains.ts) still filter by tenant_id in the app layer.

import { promises as dns } from 'node:dns';
import { randomBytes } from 'node:crypto';
import { prisma, withTenant } from '@wizeworks/db';
import { createTtlCache } from './ttl-cache.js';

// ── THE ZONES WE OWN ────────────────────────────────────────────────────────
//
// More than one, because more than one BRAND is served by this process. A sparx
// tenant lives on `<slug>.sparx.zone`; a Piggles tenant lives on
// `<slug>.piggles.site` (piggles/CLAUDE.md, "The three surfaces").
//
// `SPARX_ZONE_DOMAINS` is a comma-separated list; the first entry is the
// DEFAULT — the zone anything that does not say otherwise is minted in. The old
// singular `SPARX_ZONE_DOMAIN` still works and means a one-entry list, so no
// existing deployment changes behaviour.
//
// WHY A LIST IS THE RIGHT SHAPE HERE, when `provisionTenant` deliberately made
// the zone a PARAMETER instead. The two questions are different. "Which zone
// does this NEW tenant get?" varies per request and can never come from the
// environment — that is why signup takes an argument. "Which zones does this
// deployment own?" is a fact about the deployment, identical for every request,
// and a list is exactly what it is.
const ZONE_LIST = (process.env.SPARX_ZONE_DOMAINS ?? process.env.SPARX_ZONE_DOMAIN ?? 'sparx.zone')
  .split(',')
  .map((zone) => zone.trim().toLowerCase())
  .filter((zone) => zone.length > 0);

/** Every zone this deployment owns, in declaration order. */
export const OWNED_ZONES: readonly string[] = ZONE_LIST.length > 0 ? ZONE_LIST : ['sparx.zone'];

/** The default zone — what a caller that names no zone gets. */
export const SPARX_ZONE = OWNED_ZONES[0]!;

// A conservative hostname check: dot-separated labels, each 1–63 chars of
// [a-z0-9-] not edge-hyphenated, 2+ labels, ≤253 total. Rejects schemes, paths,
// ports, and wildcards before anything touches the DB.
//
// Declared HERE, above the zone helpers, because `zoneToUse` validates with it
// and `CNAME_TARGET` calls that at module load — a `const` further down the file
// is still in its temporal dead zone at that moment.
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
 * `SPARX_ZONE_DOMAINS` is an environment variable, so it can be — and locally is
 * — SHORT of a zone this deployment is genuinely serving; signup does not consult
 * it at all (`provisionTenant` mints from the brand's own zone), so a Piggles
 * business already living on `piggles.site` had its zone read back correctly by
 * `tenantZone` and then DISCARDED here, and its second site was minted on
 * `sparx.zone`. Two gates, and fixing only the first fixed nothing.
 *
 * What makes this safe is where the argument comes from. Every caller that names
 * a zone passes `await tenantZone(tenantId)`, which reads it off a host the
 * platform minted itself — so the zone is one we are already serving that tenant
 * on, by construction. The shape check is the honest guard: it rejects junk
 * without pretending an env var knows the answer.
 */
function zoneToUse(zoneDomain?: string | null): string {
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

/** The CNAME target for a given zone — the shared ingress, under the brand's own
 *  name. Piggles tenants are told `customers.piggles.site`, which is the value
 *  `piggles/packages/config/src/product.ts` also advertises; a sparx tenant is
 *  told `customers.sparx.zone`. Same address, and the customer must never be
 *  handed another company's hostname to point their domain at. */
export function cnameTargetFor(zoneDomain?: string | null): string {
  const zone = zoneToUse(zoneDomain);
  if (zone === SPARX_ZONE && process.env.SPARX_CNAME_TARGET) {
    return process.env.SPARX_CNAME_TARGET;
  }
  return `customers.${zone}`;
}

// The default zone's CNAME target. Retained as a constant because several
// callers legitimately have no tenant in hand (the operator console lists the
// record before a tenant is chosen); anything that DOES know the tenant should
// call `cnameTargetFor(await tenantZone(id))` instead.
export const CNAME_TARGET = cnameTargetFor(SPARX_ZONE);

// Where the control-proof TXT record lives: `_sparx-verify.<host>`.
const TXT_PREFIX = '_sparx-verify.';

/** True for a host inside ANY zone we own. Those are issued by us, never
 *  tenant-verified, and can't be connected as a "custom" domain — which has to
 *  hold for every brand, or a Piggles tenant could "connect"
 *  `someone-else.piggles.site` as though it were their own domain. */
export function isZoneHost(host: string): boolean {
  return zoneOf(host) !== null;
}

/** The always-on subdomain for a property: the primary keeps the bare
 *  `<tenant>.sparx.zone` (backward-compatible with the pre-multi-site host the
 *  Caddy endpoint already authorized); additional sites get the HIERARCHICAL
 *  `<property>.<tenant>.sparx.zone`. Both are globally unique because tenant
 *  slugs are unique and property slugs are unique within a tenant.
 *
 *  Why hierarchical (not the old flat `<tenant>-<property>` join): the flat form
 *  is AMBIGUOUS — `korous-store-brandonkorous` can't be split back into tenant +
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
 *  ⚠️ NEVER PUT AN EDGE-TERMINATING PROXY IN FRONT OF THIS. Behind the
 *  Cloudflare Tunnel, TLS terminated at Cloudflare's edge, Caddy held no
 *  certificate at all, and every host depended instead on Universal SSL —
 *  whose SANs are exactly `sparx.zone` and `*.sparx.zone`. A wildcard matches
 *  ONE label (RFC 6125 §6.4.3), so it covered `<tenant>.sparx.zone` and NOT
 *  `<property>.<tenant>.sparx.zone`: the edge had no certificate for the longer
 *  name and answered the ClientHello with handshake_failure (alert 40). Every
 *  non-primary site of every multi-site tenant was unreachable over HTTPS, and
 *  it presented as a browser SSL error rather than a 404, which is why it read
 *  like a certificate problem rather than a routing one. Ingress is a
 *  `Service type=LoadBalancer` (`k8s/ingress`) precisely so that cannot recur —
 *  the tunnel had no inbound path, so Caddy could never complete an ACME
 *  challenge behind it. `*.sparx.zone` must stay DNS-only for the same reason.
 *
 *  `zoneDomain` names which owned zone to mint in, and defaults to the first —
 *  so every existing caller is unchanged. A caller that has a tenant should pass
 *  `await tenantZone(tenantId)`: minting a SECOND site for a Piggles business
 *  under the default zone would give one business two sites in two different
 *  brands' zones, and the second one would be `<prop>.<tenant>.sparx.zone` on a
 *  console that never mentions sparx.
 *
 *  The zone is taken as given once it is well-formed — see `zoneToUse` for why
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

/**
 * The zone a tenant's sites live in, read off the subdomain it already has.
 *
 * Derived, never branched on: provisioning recorded the answer at signup when it
 * created `<slug>.<zoneDomain>`, so the honest way to find it later is to look at
 * that row rather than to re-decide it from the tenant's brand. It also means a
 * third brand needs no change here at all.
 *
 * Falls back to the default zone when the tenant has no subdomain row — which is
 * every pre-multi-zone tenant, and is exactly right for them.
 *
 * NOT the same as falling back when `OWNED_ZONES` has not been told about the
 * tenant's zone. That happens whenever `SPARX_ZONE_DOMAINS` is short of a zone this
 * deployment is actually serving — the local stack sets neither variable, so the list
 * is `['sparx.zone']` and every Piggles tenant's `piggles.site` row goes unrecognised.
 * The old fallback then handed that tenant's second site `<site>.<tenant>.sparx.zone`:
 * one business with two sites in two brands' zones, the second named after a product
 * it has never heard of, which is the exact outcome the caller's comment says this
 * function exists to prevent. Reading the zone off the HOST closes it — the tenant is
 * already being served there, so it is the one answer that cannot be wrong, and it
 * stops a missing config entry from silently crossing the brand boundary.
 */
export async function tenantZone(tenantId: string): Promise<string> {
  const rows = await prisma.domain.findMany({
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
    // `zoneOf` everywhere first would skip past the primary site's unrecognised zone
    // and settle on a later row's recognised one — which is precisely how one wrong
    // host becomes every subsequent site's host.
    const zone = zoneOf(row.host) ?? mintedZoneOf(row.host);
    if (zone) return zone;
  }
  return SPARX_ZONE;
}

/** The zone out of a host the platform minted itself. Every `type: 'subdomain'` row is
 *  one, so its last two labels ARE the zone — this reads back what provisioning wrote
 *  rather than trusting anything a tenant typed. It is what answers when
 *  `SPARX_ZONE_DOMAINS` is short of a zone this deployment is really serving. */
function mintedZoneOf(host: string): string | null {
  const labels = host.split('.');
  return labels.length >= 3 ? labels.slice(-2).join('.') : null;
}

/** A fresh DNS-control-proof token (the tenant adds it as a TXT record). */
export function newVerificationToken(): string {
  return `sparx-verify=${randomBytes(16).toString('hex')}`;
}

/** True when `host` is a subdomain (three or more dot-separated labels, e.g.
 *  `shop.example.com`). Subdomains only require a CNAME for ownership proof —
 *  the CNAME itself routes traffic AND proves the owner set it. Apex domains
 *  (two labels, e.g. `example.com`) additionally need a TXT control-proof
 *  because CNAME-at-apex is non-standard and many DNS providers don't allow it. */
export function isSubdomainHost(host: string): boolean {
  return host.split('.').length >= 3;
}

/** The DNS records the tenant must add to connect a custom `host` (docs/24 §4):
 *  always a CNAME → the shared ingress; a TXT control proof ONLY for apex
 *  domains (when `token` is non-null). For subdomains the CNAME is sufficient
 *  proof of ownership and the `txt` field is null. The dashboard renders these
 *  verbatim. */
export function connectInstructions(
  host: string,
  token: string | null,
  /** The tenant's own CNAME target — `cnameTargetFor(await tenantZone(id))`.
   *  Defaults to the platform's default zone for callers that have no tenant in
   *  hand. A Piggles customer told to point their domain at
   *  `customers.sparx.zone` is being handed another company's hostname, and it
   *  is the kind of instruction people paste into a registrar and never revisit. */
  cnameTarget: string = CNAME_TARGET
): {
  cname: { name: string; value: string };
  txt: { name: string; value: string } | null;
} {
  return {
    cname: { name: host, value: cnameTarget },
    txt: token ? { name: `${TXT_PREFIX}${host}`, value: token } : null,
  };
}

/** Poll DNS for the control-proof TXT at `_sparx-verify.<host>`. True when any
 *  TXT chunk-set joins to exactly the expected token. Never throws — a missing
 *  record / NXDOMAIN / timeout resolves false (treated as "not yet verified"). */
export async function verifyTxtToken(host: string, token: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(`${TXT_PREFIX}${host}`);
    // Each record is an array of string chunks that must be concatenated.
    return records.some((chunks) => chunks.join('') === token);
  } catch {
    return false;
  }
}

/** Verify that `host` has a CNAME record resolving to `target`. Never throws —
 *  NXDOMAIN / timeout / non-CNAME answers resolve false. Used to confirm
 *  subdomain ownership and to poll DNS propagation in the domain-worker. */
export async function verifyCname(host: string, target: string): Promise<boolean> {
  try {
    const cnames = await dns.resolveCname(host);
    const normalized = target.replace(/\.$/, '');
    return cnames.some((c) => c.replace(/\.$/, '') === normalized);
  } catch {
    return false;
  }
}

/** Resolution result: the tenant + property a routable host points at, with both
 *  the stable slugs (for downstream public reads) and ids. */
export interface SiteRoute {
  tenantId: string;
  tenantSlug: string;
  propertyId: string;
  propertySlug: string;
}

/** Cached host→route resolution — the public entrypoint. Normalizes the host, then
 *  serves from a short per-pod TTL cache (see the cache note below), falling back to
 *  the uncached DB resolver on a miss. Returns null for junk or an unknown host. */
export async function resolveSiteByHost(rawHost: string): Promise<SiteRoute | null> {
  const host = normalizeHost(rawHost);
  if (!host) return null;
  return resolveThroughCache(host);
}

// Host→route is the single highest-QPS DB path in the platform: every public request
// AND every Caddy on-demand-TLS ask resolves here, and each miss opens an interactive
// transaction — one of PgBouncer's transaction-mode server slots (DEFAULT_POOL_SIZE) —
// for a single-row read. Uncached, this path both saturates that shared pool and
// starves under it; the prod P2028 "Unable to start a transaction in the given time"
// bursts trace straight back here. A host maps to the same tenant+site for its
// lifetime, so a short per-pod TTL collapses the volume to ~one resolve per host per
// window. A freshly-connected domain starts routing within the miss TTL, and the
// domain-worker advances status over minutes regardless.
const hostCache = createTtlCache<SiteRoute | null>({ hitTtlMs: 60_000, missTtlMs: 15_000 });

function resolveThroughCache(host: string): Promise<SiteRoute | null> {
  return hostCache.get(host, () => resolveSiteByHostUncached(host));
}

/** Map an already-normalized, non-empty Host to a tenant + property (docs/49 §5).
 *  Callers go through `resolveSiteByHost` (which normalizes + caches); this is the
 *  uncached DB resolution.
 *
 *  1. Exact match in `domains` (any custom/purchased/subdomain row that's live).
 *  2. Bare `<tenant>.sparx.zone` → tenant by slug + its PRIMARY property (the
 *     backward-compatible path; works even before a subdomain row is backfilled).
 *  3. Hierarchical `<property>.<tenant>.sparx.zone` → that tenant's named property.
 *
 *  Reads the non-RLS `domains`/`tenants` tables directly; the property lookup is
 *  scoped by the resolved tenant_id in the query. Returns null for an unknown
 *  host (the caller 404s / denies). */
async function resolveSiteByHostUncached(host: string): Promise<SiteRoute | null> {
  // 1. Exact host row — the general path (custom domains + additional-site
  //    subdomains). `domains` is non-RLS, so the bare client reads it directly.
  //    A connected (BYO) domain routes only once 'verified'/'active' (a pending
  //    connect can't hijack a host). A PURCHASED domain we registered ourselves
  //    and pointed at our ingress has no ownership ambiguity, so it routes — and
  //    is cert-authorized — the moment it exists (pending_ssl/verifying), without
  //    waiting on the domain-worker to advance status. The globally-unique `host`
  //    stays the cross-tenant guard either way. The property's slug/status come
  //    from a SEPARATE tenant-scoped read below — `properties` is FORCE RLS, so a
  //    nested include from the bare client would be filtered to null in prod.
  const row = await prisma.domain.findUnique({
    where: { host },
    select: { status: true, type: true, tenantId: true, propertyId: true },
  });
  if (
    row &&
    (row.status === 'verified' ||
      row.status === 'active' ||
      (row.type === 'purchased' && (row.status === 'pending_ssl' || row.status === 'verifying')))
  ) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: row.tenantId },
      select: { slug: true, status: true },
    });
    if (tenant?.status === 'active') {
      const property = await withTenant({ tenantId: row.tenantId }, (tx) =>
        tx.property.findUnique({
          where: { id: row.propertyId },
          select: { slug: true, status: true },
        })
      );
      if (property && property.status !== 'archived') {
        return {
          tenantId: row.tenantId,
          tenantSlug: tenant.slug,
          propertyId: row.propertyId,
          propertySlug: property.slug,
        };
      }
    }
  }

  // 2. Bare `<tenant>.<owned zone>` fallback → primary property. Survives even
  //    if no subdomain row exists yet (older tenants, pre-backfill).
  //
  //    Any owned zone, not just the default one: this path is what keeps a
  //    tenant reachable when its `domains` row is missing, and a Piggles tenant
  //    needs that safety net for the same reasons a sparx one does.
  const hostZone = zoneOf(host);
  if (hostZone && host !== hostZone) {
    const label = host.slice(0, -(hostZone.length + 1));
    if (label.length > 0 && !label.includes('.')) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: label },
        select: { id: true, slug: true, status: true },
      });
      if (tenant?.status === 'active') {
        // `properties` is FORCE RLS — read through withTenant so the policy's
        // current_tenant_id() matches (the bare client sees zero rows in prod).
        const primary = await withTenant({ tenantId: tenant.id }, (tx) =>
          tx.property.findFirst({
            where: { isPrimary: true },
            select: { id: true, slug: true },
          })
        );
        if (primary) {
          return {
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            propertyId: primary.id,
            propertySlug: primary.slug,
          };
        }
      }
    }
  }

  // 3. Hierarchical `<property>.<tenant>.<owned zone>` fallback → that tenant's
  //    named property. The additional-site analogue of path 2: survives a missing
  //    subdomain row (pre-backfill, or the window while the host-scheme migration
  //    rolls). Splits on the SINGLE remaining dot — exactly two labels — so it
  //    never collides with the bare-tenant path (one label) or deeper hosts.
  if (hostZone && host !== hostZone) {
    const labels = host.slice(0, -(hostZone.length + 1)).split('.');
    if (labels.length === 2 && labels[0] && labels[1]) {
      const [propertyLabel, tenantLabel] = labels;
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantLabel },
        select: { id: true, slug: true, status: true },
      });
      if (tenant?.status === 'active') {
        const property = await withTenant({ tenantId: tenant.id }, (tx) =>
          tx.property.findFirst({
            where: { slug: propertyLabel, status: { not: 'archived' } },
            select: { id: true, slug: true },
          })
        );
        if (property) {
          return {
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            propertyId: property.id,
            propertySlug: property.slug,
          };
        }
      }
    }
  }

  return null;
}

/** Caddy authorization: is this host allowed to mint a TLS cert? True for any
 *  resolvable site host. Thin wrapper over resolveSiteByHost so the ask endpoint
 *  and the storefront share one source of truth. */
export async function isHostAuthorized(rawHost: string): Promise<SiteRoute | null> {
  return resolveSiteByHost(rawHost);
}
