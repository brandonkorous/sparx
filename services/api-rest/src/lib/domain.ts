// Domain helpers (docs/49 §5, docs/24) — host normalization, the always-on
// `*.sparx.zone` subdomain minting, BYO-domain DNS verification, and the
// host→property resolution that powers both the storefront (apps/site) and the
// Caddy on-demand-TLS ask endpoint.
//
// `domains` is a NON-RLS dispatch table (like `tenants`): resolution runs BEFORE
// any tenant is known, so these reads go through the bare `prisma` client, never
// withTenant. `host` is globally unique — that uniqueness is the cross-tenant
// guard (a host can't be claimed by two tenants). Management writes (in
// routes/v1/domains.ts) still filter by tenant_id in the app layer.

import { promises as dns } from 'node:dns';
import { randomBytes } from 'node:crypto';
import { prisma, withTenant } from '@sparx/db';
import { createTtlCache } from './ttl-cache.js';

// The zone we own — `<label>.sparx.zone` subdomains issue instantly (no DNS
// verification needed, we control the zone). Kept in sync with the Caddy ask
// endpoint (routes/internal/domain-check.ts) and apps/site SPARX_ZONE_DOMAIN.
export const SPARX_ZONE = process.env.SPARX_ZONE_DOMAIN ?? 'sparx.zone';
const ZONE_SUFFIX = `.${SPARX_ZONE}`;

// The CNAME target tenants point a custom domain at (the shared ingress). Caddy
// terminates TLS for it via on-demand certs once the host is authorized.
export const CNAME_TARGET = process.env.SPARX_CNAME_TARGET ?? `customers.${SPARX_ZONE}`;

// Where the control-proof TXT record lives: `_sparx-verify.<host>`.
const TXT_PREFIX = '_sparx-verify.';

// A conservative hostname check: dot-separated labels, each 1–63 chars of
// [a-z0-9-] not edge-hyphenated, 2+ labels, ≤253 total. Rejects schemes, paths,
// ports, and wildcards before anything touches the DB.
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

/** True for a host inside the zone we own (`*.sparx.zone`). Those are issued by
 *  us, never tenant-verified, and can't be connected as a "custom" domain. */
export function isZoneHost(host: string): boolean {
  return host === SPARX_ZONE || host.endsWith(ZONE_SUFFIX);
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
 *  challenge behind it. `*.sparx.zone` must stay DNS-only for the same reason. */
export function mintZoneHost(tenantSlug: string, propertySlug: string, isPrimary: boolean): string {
  return isPrimary ? `${tenantSlug}${ZONE_SUFFIX}` : `${propertySlug}.${tenantSlug}${ZONE_SUFFIX}`;
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
  token: string | null
): {
  cname: { name: string; value: string };
  txt: { name: string; value: string } | null;
} {
  return {
    cname: { name: host, value: CNAME_TARGET },
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

  // 2. Bare `<tenant>.sparx.zone` fallback → primary property. Survives even if
  //    no subdomain row exists yet (older tenants, pre-backfill).
  if (host.endsWith(ZONE_SUFFIX)) {
    const label = host.slice(0, -ZONE_SUFFIX.length);
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

  // 3. Hierarchical `<property>.<tenant>.sparx.zone` fallback → that tenant's
  //    named property. The additional-site analogue of path 2: survives a missing
  //    subdomain row (pre-backfill, or the window while the host-scheme migration
  //    rolls). Splits on the SINGLE remaining dot — exactly two labels — so it
  //    never collides with the bare-tenant path (one label) or deeper hosts.
  if (host.endsWith(ZONE_SUFFIX)) {
    const labels = host.slice(0, -ZONE_SUFFIX.length).split('.');
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
