// Platform-metrics computation for the operator console (docs/apps/admin/build-plan.md
// §5 Slice 3). Pure + testable: `computeMetrics` takes the raw tenant rows (read
// once from the non-RLS `tenants` dispatch table — no per-tenant scans) plus the
// window and "now", and derives every cross-tenant figure in memory.
//
// Everything here comes from columns on the `tenants` row itself (status,
// subscription state, `settings.modules`, createdAt). Metrics that would need
// tenant-scoped tables (storage, email volume, revenue-over-time, setup time)
// are deliberately excluded — they require a platform-daily rollup + cron, since
// `sparx_app` is NOBYPASSRLS and those tables are FORCE-RLS (a single cross-tenant
// aggregate returns nothing without a tenant GUC).

import { deriveModuleStates, type ModuleSlug } from '@sparx/modules';
import { MODULE_MONTHLY_CENTS } from '@sparx/billing';
import type { OperatorMetricsModule, OperatorMetricsResult } from '@sparx/operator';

/** The minimal tenant projection the metrics need (mirrors the route's select). */
export interface MetricsRow {
  status: string;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
  settings: unknown;
  createdAt: Date;
}

const MS_PER_DAY = 86_400_000;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** UTC `YYYY-MM-DD` for a Date. */
function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function planTypeOf(settings: unknown): string | undefined {
  return (settings as { billing?: { planType?: string } } | null)?.billing?.planType;
}

export function computeMetrics(
  rows: MetricsRow[],
  windowDays: number,
  now: Date
): OperatorMetricsResult {
  const total = rows.length;
  const lifecycle = {
    total,
    active: 0,
    suspended: 0,
    trialing: 0,
    pastDue: 0,
    canceled: 0,
    paused: 0,
    enterprise: 0,
    withSubscription: 0,
    pendingCancel: 0,
  };

  const moduleActive = new Map<string, number>();
  const moduleBilled = new Map<string, number>();
  let mrrTotalCents = 0;
  let payingTenants = 0;

  const windowStartMs = now.getTime() - windowDays * MS_PER_DAY;
  const day7Ms = now.getTime() - 7 * MS_PER_DAY;
  const day30Ms = now.getTime() - 30 * MS_PER_DAY;
  const dayCount = new Map<string, number>();
  let windowTotal = 0;
  let last7 = 0;
  let last30 = 0;

  for (const row of rows) {
    if (row.status === 'active') lifecycle.active += 1;
    else if (row.status === 'suspended') lifecycle.suspended += 1;

    switch (row.subscriptionStatus) {
      case 'trialing':
        lifecycle.trialing += 1;
        break;
      case 'past_due':
        lifecycle.pastDue += 1;
        break;
      case 'canceled':
      case 'unpaid':
        lifecycle.canceled += 1;
        break;
      case 'paused':
        lifecycle.paused += 1;
        break;
      default:
        break;
    }
    if (row.stripeSubscriptionId) lifecycle.withSubscription += 1;
    if (row.cancelAtPeriodEnd) lifecycle.pendingCancel += 1;
    if (planTypeOf(row.settings) === 'enterprise') lifecycle.enterprise += 1;

    const states = deriveModuleStates(row.settings);
    let tenantMrr = 0;
    for (const key of Object.keys(states) as ModuleSlug[]) {
      if (states[key].enabled) moduleActive.set(key, (moduleActive.get(key) ?? 0) + 1);
      if (states[key].source === 'explicit') {
        const price = MODULE_MONTHLY_CENTS[key] ?? 0;
        if (price > 0) {
          moduleBilled.set(key, (moduleBilled.get(key) ?? 0) + 1);
          tenantMrr += price;
        }
      }
    }
    mrrTotalCents += tenantMrr;
    if (tenantMrr > 0) payingTenants += 1;

    const createdMs = row.createdAt.getTime();
    if (createdMs >= windowStartMs) {
      windowTotal += 1;
      const key = utcDay(row.createdAt);
      dayCount.set(key, (dayCount.get(key) ?? 0) + 1);
    }
    if (createdMs >= day7Ms) last7 += 1;
    if (createdMs >= day30Ms) last30 += 1;
  }

  // Dense daily signup series across the window (zero-filled), UTC day-aligned.
  const series: { date: string; count: number }[] = [];
  const startDay = Date.UTC(
    new Date(windowStartMs).getUTCFullYear(),
    new Date(windowStartMs).getUTCMonth(),
    new Date(windowStartMs).getUTCDate()
  );
  const endDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let ms = startDay; ms <= endDay; ms += MS_PER_DAY) {
    const key = utcDay(new Date(ms));
    series.push({ date: key, count: dayCount.get(key) ?? 0 });
  }

  // The full module universe (deriveModuleStates always returns every ModuleSlug),
  // so unused modules still report 0% adoption.
  const universe = Object.keys(deriveModuleStates(null)) as ModuleSlug[];
  const modules: OperatorMetricsModule[] = universe
    .map((key) => {
      const active = moduleActive.get(key) ?? 0;
      const billed = moduleBilled.get(key) ?? 0;
      return {
        key,
        active,
        billed,
        adoptionPct: total ? round1((active / total) * 100) : 0,
        mrrCents: billed * (MODULE_MONTHLY_CENTS[key] ?? 0),
      };
    })
    .sort((a, b) => b.active - a.active || b.mrrCents - a.mrrCents);

  const churnDenom = lifecycle.active + lifecycle.canceled;

  return {
    generatedAt: now.toISOString(),
    lifecycle,
    revenue: {
      mrrTotalCents,
      arrTotalCents: mrrTotalCents * 12,
      arpuCents: payingTenants ? Math.round(mrrTotalCents / payingTenants) : 0,
      payingTenants,
    },
    churn: {
      canceled: lifecycle.canceled,
      pendingCancel: lifecycle.pendingCancel,
      ratePct: churnDenom ? round1((lifecycle.canceled / churnDenom) * 100) : 0,
    },
    signups: {
      windowDays,
      total: windowTotal,
      last7,
      last30,
      series,
    },
    modules,
  };
}
