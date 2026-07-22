// Per-site commerce revenue rollup (docs/131 §6) — the exemplar for the analytics
// per-site phase, end to end against real Postgres + RLS through the service spine.
//
// The case is the same Korous test the whole remediation turns on: ONE tenant
// running two unrelated businesses (Bob's Parts + Savory Donuts), plus revenue
// whose site was DELETED (an order with a null property_id — the "unattributed"
// bucket). The rollup must:
//   • give each site ONLY its own revenue (a per-site read never blends the two);
//   • keep orphaned revenue OUT of any single site, yet IN the all-sites total —
//     the exact decision made up front for this phase (an explicit unattributed
//     bucket, not folded into the primary).
//
// PREREQUISITES (this test cannot pass until they are done — it is authored as the
// regression guard for when the migration lands, mirroring the codebase's
// migration-gated test convention):
//   1. Apply migration 20270105_per_site_analytics_rollups (adds property_id to
//      rollup_commerce_daily_revenue). The column does not exist until then.
//   2. Regenerate the Prisma client so RollupCommerceDailyRevenue carries propertyId.
// Both are the standard pipeline/regen steps; run `pnpm --filter @sparx/api-rest
// test -- revenue-rollup-per-site` afterwards.

import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { invalidateModuleCache } from '@sparx/auth';
import { reportingService } from '@sparx/commerce';
import { prisma, withTenant } from '@sparx/db';
import { createTestTenant, dropTestTenant, type TestTenant } from '../helpers.js';

async function enableCommerce(tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: { modules: { commerce: { enabled: true } } } },
  });
  invalidateModuleCache();
}

/** A second site under the tenant (`properties` is FORCE RLS → tenant-scoped exec). */
async function createSite(t: TestTenant, name: string): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
    const row = await tx.property.create({
      data: { tenantId: t.tenantId, slug, name, isPrimary: false },
      select: { id: true },
    });
    return row.id;
  });
}

async function seedCustomer(t: TestTenant, propertyId: string): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const c = await tx.customer.create({
      data: {
        tenantId: t.tenantId,
        propertyId,
        type: 'retail',
        email: `buyer-${crypto.randomBytes(4).toString('hex')}@example.com`,
      },
      select: { id: true },
    });
    return c.id;
  });
}

// A paid order on `propertyId` (null = the deleted-site / unattributed bucket),
// placed on a CLOSED day so the read serves it from the rollup, not the live
// overlay — which is the code path this test exists to exercise.
async function seedOrder(
  t: TestTenant,
  propertyId: string | null,
  customerId: string,
  amount: number,
  placedAt: Date
): Promise<void> {
  await withTenant({ tenantId: t.tenantId }, async (tx) => {
    await tx.order.create({
      data: {
        tenantId: t.tenantId,
        propertyId,
        customerId,
        orderNumber: `ORD-${crypto.randomBytes(4).toString('hex')}`,
        status: 'delivered',
        paymentStatus: 'paid',
        subtotal: amount,
        total: amount,
        placedAt,
      },
    });
  });
}

const DAY = 86_400_000;

describe('commerce revenue rollup — per-site (docs/131 §6)', () => {
  it('splits revenue per site and keeps orphaned revenue in the all-sites total only', async () => {
    const t = await createTestTenant('owner');
    try {
      await enableCommerce(t.tenantId);
      const ctx = { tenantId: t.tenantId, userId: t.userId };

      const parts = t.propertyId; // primary — Bob's Parts
      const donuts = await createSite(t, 'Savory Donuts');

      // A closed day (5 days ago) so the timeseries reads it from the rollup.
      const closedDay = new Date(Date.now() - 5 * DAY);

      // Parts: two orders totalling $300. Donuts: one $50 order. Orphan: one $70
      // order with no site (its business was deleted). Tenant-wide total = $420.
      await seedOrder(t, parts, await seedCustomer(t, parts), 100, closedDay);
      await seedOrder(t, parts, await seedCustomer(t, parts), 200, closedDay);
      await seedOrder(t, donuts, await seedCustomer(t, donuts), 50, closedDay);
      await seedOrder(t, null, await seedCustomer(t, parts), 70, closedDay);

      // Build the rollup from the seeded orders (this is also the backfill).
      await reportingService.reconcileRevenueRollup(ctx, { sinceDays: 30 });

      const range = {
        from: new Date(Date.now() - 30 * DAY).toISOString(),
        to: new Date().toISOString(),
      };
      const read = (propertyId?: string) =>
        reportingService.revenueTimeseries(ctx, {
          range,
          ...(propertyId ? { propertyId } : {}),
        });

      const partsSeries = await read(parts);
      const donutsSeries = await read(donuts);
      const allSeries = await read(); // undefined → tenant-wide total

      // Parts sees ONLY its own two orders — never the donut shop's, never the orphan.
      expect(partsSeries.totals.ordersCount).toBe(2);
      expect(partsSeries.totals.netCents).toBe(30000);

      // Donuts sees only its single order.
      expect(donutsSeries.totals.ordersCount).toBe(1);
      expect(donutsSeries.totals.netCents).toBe(5000);

      // All-sites is the whole tenant INCLUDING the orphaned $70 — the unattributed
      // bucket surfaces here and nowhere else. It is strictly MORE than the sum of
      // the per-site reads (30000 + 5000 = 35000), and the difference is exactly
      // the orphan (7000) — proof the null bucket is neither dropped nor folded
      // into a site.
      expect(allSeries.totals.ordersCount).toBe(4);
      expect(allSeries.totals.netCents).toBe(42000);
      expect(
        allSeries.totals.netCents - (partsSeries.totals.netCents + donutsSeries.totals.netCents)
      ).toBe(7000);
    } finally {
      await dropTestTenant(t.tenantId);
    }
  });
});
