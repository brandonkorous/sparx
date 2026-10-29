// Iterate Commerce-active tenants.
//
// Mirrors @wizeworks/crm's listCrmActiveTenants — the same module-gate rule
// applies here: disabled tenants do zero scheduled work. The reservation
// reaper (and any future inventory scheduler) calls this to enumerate
// tenants worth processing.

import { prisma } from '@wizeworks/db';

import { LOOKBACK_DAYS as REPEAT_LOOKBACK_DAYS } from '../services/repeat-start-service';

/** All tenants where `settings.modules.commerce.enabled = true`. Status
 *  is filtered to 'active' so suspended/cancelled tenants don't get
 *  cycles. */
export async function listCommerceActiveTenants(): Promise<{ id: string }[]> {
  return prisma.tenant.findMany({
    where: {
      status: 'active',
      settings: { path: ['modules', 'commerce', 'enabled'], equals: true },
    },
    select: { id: true },
  });
}

/** All tenants where `settings.modules.dropship.enabled = true` (status
 *  'active'). Dropship is its own module flag, distinct from commerce, so the
 *  dropship-orders rollup reconcile enumerates this set rather than the commerce
 *  one — a commerce-only tenant does no dropship rollup work. */
export async function listDropshipActiveTenants(): Promise<{ id: string }[]> {
  return prisma.tenant.findMany({
    where: {
      status: 'active',
      settings: { path: ['modules', 'dropship', 'enabled'], equals: true },
    },
    select: { id: true },
  });
}

/** Tenants with a renewal due by `asOf`, a past_due subscription, or a paid order
 *  waiting for its repeat order, in one cross-tenant scan. `asOf` is the tick's
 *  own clock, so a dry-run date scans against the date it bills against. */
export async function listTenantsWithDueSubscriptionWork(
  asOf: Date = new Date()
): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ tenant_id: string }[]>`
    SELECT tenant_id FROM find_tenants_with_due_subscription_work(${asOf}, ${REPEAT_LOOKBACK_DAYS}::int)
  `;
  return new Set(rows.map((r) => r.tenant_id));
}

/** Tenants holding an unmarked, non-empty basket nobody has bought yet, in one
 *  cross-tenant scan: the carts listCartSiteScopes reads before each site's idle
 *  threshold is applied. */
export async function listTenantsWithOpenCarts(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ tenant_id: string }[]>`
    SELECT tenant_id FROM find_tenants_with_open_carts()
  `;
  return new Set(rows.map((r) => r.tenant_id));
}

/** Tenants holding an expired cart reservation at `now`, in one cross-tenant scan (WW-9). */
export async function listTenantsWithDueReservations(now: Date = new Date()): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ tenant_id: string }[]>`
    SELECT tenant_id FROM find_tenants_with_due_reservations(${now})
  `;
  return new Set(rows.map((r) => r.tenant_id));
}
