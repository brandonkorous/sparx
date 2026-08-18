// Tenant slug → tenant id, cached (docs/127 §5).
//
// Every public storefront read starts by turning the `?tenant=<slug>` query into a
// tenant id. That lookup was hand-rolled identically in a dozen public routes, and
// every copy was UNCACHED — so a single storefront page render fired ~6 of them, each
// its own round-trip, while `resolvePublicPropertyId` sitting directly beside them in
// the same handlers had a 60s TTL cache.
//
// That asymmetry is exactly the pattern ttl-cache.ts was written to fix: uncached
// per-request resolutions saturate PgBouncer's transaction-mode server slots and
// surface as the prod P2028 "Unable to start a transaction in the given time" bursts.
// The tenant lookup was the last instance of it on the hot path.
//
// `tenants` is the one NON-RLS table (it is the dispatch table — see 02-tenant.prisma),
// so this is a plain `prisma` read rather than a `withTenant` transaction. It is still
// worth caching: it is a round-trip per call, and the (slug → id) mapping is immutable
// in practice — a slug is never reassigned to a different tenant.
//
// MISSES ARE NEVER CACHED. The loader THROWS rather than resolving null, so a rejected
// lookup leaves nothing in the cache (createTtlCache only stores a resolved value).
// That is deliberate and matches `resolvePublicPropertyId`: caching a negative result
// makes a newly-created tenant 404 for the length of the TTL, which is a real
// create-then-read race — a just-provisioned site is exactly when someone loads it.
//
// NOT a security boundary. This resolves a PUBLIC identifier to an internal id; every
// read performed with that id is still RLS-scoped. A stale entry can only ever name the
// tenant that slug already belonged to.

import { prisma } from '@wizeworks/db';
import { notFound } from '@wizeworks/api-core/errors';
import { createTtlCache } from './ttl-cache.js';

const tenantIdCache = createTtlCache<string>({ hitTtlMs: 300_000 });

/** Tenant id for a public `?tenant=<slug>`; 404 when no tenant owns it. */
export async function requireTenantIdBySlug(slug: string): Promise<string> {
  return tenantIdCache.get(slug, async () => {
    const row = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    // Throwing (rather than returning null) is what keeps misses out of the cache.
    if (!row) throw notFound('Tenant', slug);
    return row.id;
  });
}
