import { computeDelta, fmtMoneyCents, fmtNumber, fmtPercent, ratio } from './format';
import type { Kpi, Raw } from './types';

// The headline KPI strip — built in priority order and gated by active modules,
// so the strip is always full and never has holes (docs research §2). Each tile
// carries a delta vs the previous period and, where it reads as a trend, a
// sparkline. Computed metrics (conversion rate, AOV) are derived here. Capped at
// 8 — the eye lands top-left, so the most important earn the earliest slots.

export function buildKpis(raw: Raw, m: ReadonlySet<string>): Kpi[] {
  const out: Kpi[] = [];
  const has = (mod: string) => m.has(mod);

  if (has('commerce') && raw.revCur) {
    out.push({
      key: 'revenue',
      label: 'Revenue',
      module: 'commerce',
      icon: 'revenue',
      value: fmtMoneyCents(raw.revCur.netRevenueCents),
      delta: computeDelta(raw.revCur.netRevenueCents, raw.revPrev?.netRevenueCents),
      spark: raw.revTs?.points.map((p) => p.netCents / 100),
      href: '/commerce',
    });
    out.push({
      key: 'orders',
      label: 'Orders',
      module: 'commerce',
      icon: 'orders',
      value: fmtNumber(raw.revCur.ordersCount),
      delta: computeDelta(raw.revCur.ordersCount, raw.revPrev?.ordersCount),
      spark: raw.revTs?.points.map((p) => p.ordersCount),
      href: '/crm/orders',
    });
  }

  // Conversion rate = orders ÷ visitors (computed; needs both modules and real
  // traffic — with zero visitors the ratio is meaningless, so skip the tile).
  if (has('commerce') && has('builder') && raw.revCur && raw.siteCur && raw.siteCur.visitors > 0) {
    const conv = ratio(raw.revCur.ordersCount, raw.siteCur.visitors) * 100;
    const prevConv =
      raw.revPrev && raw.sitePrev
        ? ratio(raw.revPrev.ordersCount, raw.sitePrev.visitors) * 100
        : undefined;
    out.push({
      key: 'conversion',
      label: 'Conversion',
      module: 'commerce',
      icon: 'conversion',
      value: fmtPercent(conv, 2),
      delta: computeDelta(conv, prevConv),
      hint: 'Orders ÷ visitors',
      spark: raw.revTs?.points.map((p, i) => {
        const v = raw.siteTs?.points[i]?.visitors ?? 0;
        return v > 0 ? (p.ordersCount / v) * 100 : 0;
      }),
      href: '/commerce',
    });
  }

  if (has('commerce') && raw.revCur) {
    out.push({
      key: 'aov',
      label: 'Avg. order value',
      module: 'commerce',
      icon: 'aov',
      value: fmtMoneyCents(raw.revCur.averageOrderValueCents),
      delta: computeDelta(raw.revCur.averageOrderValueCents, raw.revPrev?.averageOrderValueCents),
      spark: raw.revTs?.points.map((p) =>
        p.ordersCount > 0 ? p.netCents / 100 / p.ordersCount : 0
      ),
      href: '/commerce',
    });
  }

  if (has('builder') && raw.siteCur) {
    out.push({
      key: 'visitors',
      label: 'Visitors',
      module: 'builder',
      icon: 'visitors',
      value: fmtNumber(raw.siteCur.visitors),
      delta: computeDelta(raw.siteCur.visitors, raw.sitePrev?.visitors),
      spark: raw.siteTs?.points.map((p) => p.visitors),
      href: '/builder',
    });
  }

  if (has('invoicing') && raw.collections) {
    out.push({
      key: 'collected',
      label: 'Collected · mo',
      module: 'invoicing',
      icon: 'collected',
      value: fmtMoneyCents(raw.collections.collectedThisMonthCents),
      delta: computeDelta(
        raw.collections.collectedThisMonthCents,
        raw.collections.collectedLastMonthCents
      ),
      hint: 'This month vs last',
      spark: raw.collectedTs?.points.map((p) => p.collectedCents / 100),
      href: '/finance',
    });
  }

  if (has('crm') && raw.leads && raw.leads.totalLeads > 0) {
    out.push({
      key: 'leads',
      label: 'New leads',
      module: 'crm',
      icon: 'leads',
      value: fmtNumber(raw.leads.totalLeads),
      hint: raw.leads.rangeLabel,
      spark: raw.acquisition?.map((p) => p.newCustomers),
      href: '/crm',
    });
  } else if (has('crm') && raw.crm) {
    out.push({
      key: 'pipeline',
      label: 'Open pipeline',
      module: 'crm',
      icon: 'leads',
      value: fmtMoneyCents(Math.round(raw.crm.pipelineValue * 100)),
      hint: `${raw.crm.openDeals} open deal${raw.crm.openDeals === 1 ? '' : 's'}`,
      spark: raw.acquisition?.map((p) => p.newCustomers),
      href: '/crm/pipelines',
    });
  }

  // Retention slot: subscriptions MRR if any, else email list size.
  if (has('commerce') && raw.subs && raw.subs.activeCount > 0) {
    out.push({
      key: 'mrr',
      label: 'MRR',
      module: 'commerce',
      icon: 'mrr',
      value: fmtMoneyCents(raw.subs.mrrCents),
      hint: `${raw.subs.activeCount} active subscription${raw.subs.activeCount === 1 ? '' : 's'}`,
      href: '/commerce/subscriptions',
    });
  } else if (has('email') && raw.growth) {
    const net = raw.growth.totals.net;
    out.push({
      key: 'subscribers',
      label: 'Subscribers',
      module: 'email',
      icon: 'subscribers',
      value: fmtNumber(raw.growth.currentSubscribers),
      hint: `${net >= 0 ? '+' : ''}${fmtNumber(net)} this period`,
      spark: raw.growth.points.map((p) => p.net),
      href: '/email',
    });
  }

  // Fallback tiles so the strip reliably fills to a clean 8 even when the
  // conversion tile is skipped (no traffic captured): outstanding receivables,
  // then pageviews. slice(0, 8) keeps only what's needed.
  if (has('invoicing') && raw.collections && raw.collections.openBalance.invoicedOpenCents > 0) {
    const ob = raw.collections.openBalance;
    out.push({
      key: 'ar',
      label: 'Outstanding',
      module: 'invoicing',
      icon: 'invoice',
      value: fmtMoneyCents(ob.invoicedOpenCents),
      hint: ob.overdueCount > 0 ? `${ob.overdueCount} overdue` : 'All current',
      spark: raw.collectedTs?.points.map((p) => p.collectedCents / 100),
      href: '/invoicing/documents',
    });
  }

  if (has('builder') && raw.siteCur) {
    out.push({
      key: 'pageviews',
      label: 'Pageviews',
      module: 'builder',
      icon: 'pageviews',
      value: fmtNumber(raw.siteCur.pageviews),
      delta: computeDelta(raw.siteCur.pageviews, raw.sitePrev?.pageviews),
      spark: raw.siteTs?.points.map((p) => p.pageviews),
      href: '/builder',
    });
  }

  return out.slice(0, 8);
}
