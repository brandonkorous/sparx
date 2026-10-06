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
import {
  SPARX_ZONE,
  normalizeHost,
  tenantZone as readTenantZone,
  zoneOf,
  zoneToUse,
} from '@wizeworks/db/site-origin';
import { createTtlCache } from './ttl-cache.js';

// ── THE ZONES WE OWN, AND THE HOST A SITE IS MINTED ON ──────────────────────
//
// The zone list, host normalization, `mintZoneHost` and `tenantZone` live in
// `@wizeworks/db/site-origin` (its `site-zones` module, with the full rationale),
// because code outside api-rest names a site's address too: the marketplace
// projection, the channel-sync worker's product feed, the MCP domain tools (sparx
// persona issue 064). They are re-exported here so every api-rest call site is
// unchanged. `tenantZone` is bound to this service's bare client, the one it has
// always read the `domains` table through.
export {
  OWNED_ZONES,
  SPARX_ZONE,
  normalizeHost,
  isValidHost,
  zoneOf,
  mintZoneHost,
  mintedZoneOf,
} from '@wizeworks/db/site-origin';

/** The zone a tenant's sites live in, read off the subdomain it already has. */
export function tenantZone(tenantId: string): Promise<string> {
  return readTenantZone(prisma, tenantId);
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
