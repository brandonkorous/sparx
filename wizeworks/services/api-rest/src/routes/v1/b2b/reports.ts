// B2B reporting reads (docs/97 §5, docs/10).
//
//   GET /v1/b2b/reports/summary
//     → account health, open quotes, pending/overdue invoices, approval queue,
//       credit extended — the founder-lens counts the B2B overview opens on
//   GET /v1/b2b/reports/timeseries?from=&to=&grain=day|week|month
//     → B2B order volume + revenue per bucket (orders whose customer belongs
//       to a B2B account)
//
// LIVE aggregates over the operational tables (no rollup): B2B order/quote/
// invoice volumes are a subset of the storefront's and every query is bounded
// by tenant (RLS) + a date range or an indexed status. The timeseries follows
// the same daily-bucket/zero-fill/grain-fold shape as the rollup charts
// (docs/97) so the chart kit consumes it identically; it graduates to a rollup
// if a tenant's B2B volume ever justifies one.
//
// B2B-module-gated (404 when disabled) + viewer-read, tenant-scoped via
// withTenant (FORCE RLS).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant, type TxClient } from '@wizeworks/db';
import { B2B_QUOTE_WORKFLOW_SLUG } from '@wizeworks/crm-schemas/builtins';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireB2bModule, toB2bContext } from '../../../lib/b2b-context.js';

const TimeseriesQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  grain: z.enum(['day', 'week', 'month']).optional(),
});

// Quotes are BillingDocuments on the system `b2b-quotes` workflow (docs/87
// convergence). "Open" = awaiting a decision — any `draft`-type stage (Draft /
// Submitted / Under Review / Quoted); `committed` (Accepted) and `void`
// (Declined/Expired) are no longer actionable.
const OPEN_QUOTE_STAGE_TYPE = 'draft';

// ── UTC-day helpers (live-aggregate twin of the rollup timeseries) ──
function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addUtcDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function eachUtcDay(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const end = startOfUtcDay(to).getTime();
  for (let d = startOfUtcDay(from); d.getTime() <= end; d = addUtcDays(d, 1)) out.push(d);
  return out;
}
function bucketStartFor(dateKey: string, grain: 'week' | 'month'): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  if (grain === 'month') {
    return utcDateKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  }
  const deltaToMonday = (d.getUTCDay() + 6) % 7;
  return utcDateKey(addUtcDays(startOfUtcDay(d), -deltaToMonday));
}

// A Decimal *dollar* SUM from $queryRaw → integer cents.
function dollarsToCents(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Math.round(v * 100);
  if (typeof v === 'bigint') return Number(v) * 100;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }
  if (typeof v === 'object' && 'toNumber' in v && typeof v.toNumber === 'function') {
    return Math.round((v as { toNumber(): number }).toNumber() * 100);
  }
  return 0;
}

function decimalToCents(d: unknown): number {
  if (d == null) return 0;
  if (typeof d === 'number') return Math.round(d * 100);
  if (typeof d === 'object' && 'toNumber' in d && typeof d.toNumber === 'function') {
    return Math.round((d as { toNumber(): number }).toNumber() * 100);
  }
  return 0;
}

interface RawDayRow {
  bucket: Date;
  orders_count: number;
  revenue: unknown;
}

// One GROUP-BY-day pass over B2B orders in [from, toExclusive), bucketed by
// placed_at's UTC date. Excludes cancelled + pending_approval (not yet real
// revenue), matching the storefront revenue convention. RLS scopes to tenant.
//
// A B2B order is identified by its customer having a b2b_account_id, NOT by
// channel — B2B orders place through the same storefront checkout everyone
// uses (docs/10 §11) and always carry channel='storefront'; no code path ever
// sets channel='b2b_portal', so the old `WHERE channel = 'b2b_portal'` filter
// silently zeroed this report for every tenant.
async function aggregateB2bOrdersByDay(
  tx: TxClient,
  from: Date,
  toExclusive: Date
): Promise<{ bucket: string; ordersCount: number; revenueCents: number }[]> {
  const rows = await tx.$queryRaw<RawDayRow[]>`
    SELECT
      (o.placed_at AT TIME ZONE 'UTC')::date AS bucket,
      COUNT(*)::int                          AS orders_count,
      COALESCE(SUM(o.total), 0)              AS revenue
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    WHERE c.company_id IS NOT NULL
      AND o.status NOT IN ('cancelled', 'pending_approval')
      AND o.placed_at >= ${from}
      AND o.placed_at < ${toExclusive}
    GROUP BY 1
    ORDER BY 1
  `;
  return rows.map((r) => ({
    bucket: utcDateKey(startOfUtcDay(new Date(r.bucket))),
    ordersCount: Number(r.orders_count ?? 0),
    revenueCents: dollarsToCents(r.revenue),
  }));
}

const reportRoutes: FastifyPluginAsync = (app) => {
  // ── Summary: account health + open quotes/invoices/approvals + credit ──
  app.get('/v1/b2b/reports/summary', async (request) => {
    await requireB2bModule(request);
    requireRole(request, 'viewer');
    const ctx = toB2bContext(request);
    const now = new Date();

    return withTenant(ctx, async (tx) => {
      const [
        accountsTotal,
        accountsActive,
        accountsCreditHold,
        openQuotes,
        openArDocs,
        approvalQueue,
        credit,
        tierGroups,
      ] = await Promise.all([
        tx.company.count({ where: { deletedAt: null } }),
        tx.company.count({ where: { deletedAt: null, status: 'active' } }),
        tx.company.count({ where: { deletedAt: null, status: 'credit_hold' } }),
        tx.billingDocument.count({
          where: {
            deletedAt: null,
            workflow: { slug: B2B_QUOTE_WORKFLOW_SLUG },
            stage: { stageType: OPEN_QUOTE_STAGE_TYPE },
          },
        }),
        // Open B2B accounts-receivable — billing_documents scoped to a Company
        // (docs/87 §15; the legacy b2b_invoices table was retired). `balance` nets
        // out partial payments, so the aging below reflects true outstanding AR.
        tx.billingDocument.findMany({
          where: {
            companyId: { not: null },
            deletedAt: null,
            status: { in: ['unpaid', 'partial', 'overdue'] },
          },
          select: { balance: true, dueAt: true },
        }),
        tx.order.count({ where: { status: 'pending_approval' } }),
        tx.company.aggregate({
          where: { deletedAt: null, status: { not: 'inactive' } },
          _sum: { creditLimit: true, creditUsed: true },
        }),
        tx.company.groupBy({
          by: ['pricingTier'],
          where: { deletedAt: null, pricingTier: { not: null } },
          _count: { _all: true },
        }),
      ]);

      // A/R aging from open documents' balance + dueAt vs now (cents). The open set
      // is small, so bucketing in JS is cheaper than four GROUP BY range queries. A
      // document with no due date counts as current (not yet overdue).
      const aging = { current: 0, d1_30: 0, d31_60: 0, d60plus: 0 };
      let outstandingCents = 0;
      let overdueCount = 0;
      let overdueCents = 0;
      let oldestOverdueDays = 0;
      for (const doc of openArDocs) {
        const c = decimalToCents(doc.balance);
        outstandingCents += c;
        const days = doc.dueAt ? Math.floor((now.getTime() - doc.dueAt.getTime()) / 86_400_000) : 0;
        if (days <= 0) {
          aging.current += c;
        } else {
          overdueCount += 1;
          overdueCents += c;
          oldestOverdueDays = Math.max(oldestOverdueDays, days);
          if (days <= 30) aging.d1_30 += c;
          else if (days <= 60) aging.d31_60 += c;
          else aging.d60plus += c;
        }
      }

      const byTier = tierGroups
        .map((g) => ({ tier: g.pricingTier ?? '—', count: g._count._all }))
        .sort((a, b) => b.count - a.count);

      return ok({
        accounts: {
          total: accountsTotal,
          active: accountsActive,
          creditHold: accountsCreditHold,
        },
        openQuotes,
        invoices: {
          outstandingCount: openArDocs.length,
          outstandingCents,
          overdueCount,
          overdueCents,
          oldestOverdueDays,
          aging,
        },
        approvalQueue,
        credit: {
          limitCents: decimalToCents(credit._sum.creditLimit),
          usedCents: decimalToCents(credit._sum.creditUsed),
        },
        byTier,
      });
    });
  });

  // ── Timeseries: B2B order volume + revenue (live aggregate) ──
  app.get('/v1/b2b/reports/timeseries', async (request) => {
    await requireB2bModule(request);
    requireRole(request, 'viewer');
    const ctx = toB2bContext(request);
    const q = TimeseriesQuery.parse(request.query);
    const grain = q.grain ?? 'day';
    const to = startOfUtcDay(q.to ? new Date(q.to) : new Date());
    const from = startOfUtcDay(q.from ? new Date(q.from) : addUtcDays(to, -29));
    const toExclusive = addUtcDays(to, 1);

    return withTenant(ctx, async (tx) => {
      const rows = await aggregateB2bOrdersByDay(tx, from, toExclusive);
      const byKey = new Map(rows.map((r) => [r.bucket, r]));

      const daily = eachUtcDay(from, to).map((d) => {
        const key = utcDateKey(d);
        const m = byKey.get(key);
        return {
          bucket: key,
          ordersCount: m?.ordersCount ?? 0,
          revenueCents: m?.revenueCents ?? 0,
        };
      });

      let points = daily;
      if (grain !== 'day') {
        const map = new Map<
          string,
          { bucket: string; ordersCount: number; revenueCents: number }
        >();
        for (const p of daily) {
          const key = bucketStartFor(p.bucket, grain);
          const cur = map.get(key);
          if (cur) {
            cur.ordersCount += p.ordersCount;
            cur.revenueCents += p.revenueCents;
          } else {
            map.set(key, { bucket: key, ordersCount: p.ordersCount, revenueCents: p.revenueCents });
          }
        }
        points = [...map.values()].sort((a, b) => (a.bucket < b.bucket ? -1 : 1));
      }

      const totals = daily.reduce(
        (acc, p) => ({
          ordersCount: acc.ordersCount + p.ordersCount,
          revenueCents: acc.revenueCents + p.revenueCents,
        }),
        { ordersCount: 0, revenueCents: 0 }
      );

      return ok({
        range: { from: utcDateKey(from), to: utcDateKey(to), grain },
        points,
        totals,
        currency: 'USD',
      });
    });
  });

  // ── Open quotes: actionable quotes with their account, newest first ──
  app.get('/v1/b2b/reports/open-quotes', async (request) => {
    await requireB2bModule(request);
    requireRole(request, 'viewer');
    const ctx = toB2bContext(request);

    return withTenant(ctx, async (tx) => {
      const quotes = await tx.billingDocument.findMany({
        where: {
          deletedAt: null,
          workflow: { slug: B2B_QUOTE_WORKFLOW_SLUG },
          stage: { stageType: OPEN_QUOTE_STAGE_TYPE },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          number: true,
          total: true,
          createdAt: true,
          validUntil: true,
          stage: { select: { name: true, customerLabel: true } },
          company: { select: { companyName: true } },
          customer: { select: { firstName: true, lastName: true, email: true } },
        },
      });

      return ok(
        quotes.map((q) => {
          const c = q.customer;
          const joined = c ? [c.firstName, c.lastName].filter(Boolean).join(' ').trim() : '';
          const customerName = joined.length > 0 ? joined : (c?.email ?? null);
          return {
            id: q.id,
            quoteNumber: q.number ?? '',
            account: q.company?.companyName ?? customerName ?? '—',
            // The workflow-stage name (Draft/Submitted/Under Review/Quoted) — the
            // quote-lifecycle signal, not BillingDocument's coarse AR status
            // (unpaid/partial/paid/overdue/void), which is meaningless pre-invoice.
            status: q.stage.name,
            totalCents: decimalToCents(q.total),
            sentAt: q.createdAt.toISOString(),
            expiresAt: q.validUntil?.toISOString() ?? null,
          };
        })
      );
    });
  });

  // ── Top accounts by total invoiced amount (a stable spend proxy that rides the
  //    billing document's b2b_account_id, unlike orders whose B2B link is on the
  //    checkout session). Newest tier/terms joined for the roster row. ──
  app.get('/v1/b2b/reports/top-accounts', async (request) => {
    await requireB2bModule(request);
    requireRole(request, 'viewer');
    const ctx = toB2bContext(request);

    return withTenant(ctx, async (tx) => {
      const groups = await tx.billingDocument.groupBy({
        by: ['companyId'],
        where: { companyId: { not: null }, deletedAt: null },
        _sum: { total: true },
        _count: { _all: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      });
      if (groups.length === 0) return ok([]);

      const ids = groups.map((g) => g.companyId).filter((id): id is string => id !== null);
      const accounts = await tx.company.findMany({
        where: { id: { in: ids } },
        select: { id: true, companyName: true, pricingTier: true, paymentTerms: true },
      });
      const byId = new Map(accounts.map((a) => [a.id, a]));

      return ok(
        groups.map((g) => {
          const a = byId.get(g.companyId!);
          return {
            accountId: g.companyId!,
            name: a?.companyName ?? '—',
            tier: a?.pricingTier ?? null,
            paymentTerms: a?.paymentTerms ?? null,
            invoiceCount: g._count._all,
            invoicedCents: decimalToCents(g._sum.total),
          };
        })
      );
    });
  });

  return Promise.resolve();
};

export default reportRoutes;
