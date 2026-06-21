// Scheduling analytics (docs/79 §12). A single read that powers the dashboard
// Reports view — booking volume + outcome mix, no-show rate, completed revenue,
// upcoming load, and the busiest services over a date range. Pure aggregation in
// JS over one tenant-scoped query (modest booking volumes; revisit with SQL
// rollups if a tenant's range ever spans tens of thousands).

import { withTenant } from '@sparx/db';

const TERMINAL = ['cancelled', 'no_show', 'completed'];

export interface SchedulingReportTotals {
  all: number;
  requested: number;
  confirmed: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

export interface TopService {
  serviceId: string;
  name: string;
  count: number;
}

export interface SchedulingReport {
  from: string;
  to: string;
  totals: SchedulingReportTotals;
  /** no_show / (completed + no_show), as a 0–100 percentage (0 when no finished bookings). */
  noShowRatePct: number;
  /** Sum of the service price of completed bookings in the range (cents). */
  revenueCents: number;
  /** Future, non-terminal bookings (load on the books right now). */
  upcomingCount: number;
  topServices: TopService[];
}

export interface SchedulingReportQuery {
  from: string;
  to: string;
}

export async function getSchedulingReport(
  tenantId: string,
  query: SchedulingReportQuery,
  nowUtc: number
): Promise<SchedulingReport> {
  return withTenant({ tenantId }, async (tx) => {
    const fromDate = new Date(query.from);
    const toDate = new Date(query.to);
    const rows = await tx.booking.findMany({
      where: { deletedAt: null, startAt: { gte: fromDate, lt: toDate } },
      select: {
        status: true,
        serviceId: true,
        service: { select: { name: true, priceCents: true } },
      },
    });

    const totals: SchedulingReportTotals = {
      all: rows.length,
      requested: 0,
      confirmed: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
    };
    let revenueCents = 0;
    const byService = new Map<string, TopService>();

    for (const b of rows) {
      if (b.status === 'requested') totals.requested += 1;
      else if (b.status === 'confirmed') totals.confirmed += 1;
      else if (b.status === 'in_progress') totals.inProgress += 1;
      else if (b.status === 'completed') totals.completed += 1;
      else if (b.status === 'cancelled') totals.cancelled += 1;
      else if (b.status === 'no_show') totals.noShow += 1;

      if (b.status === 'completed') revenueCents += b.service?.priceCents ?? 0;

      const entry = byService.get(b.serviceId) ?? {
        serviceId: b.serviceId,
        name: b.service?.name ?? 'Service',
        count: 0,
      };
      entry.count += 1;
      byService.set(b.serviceId, entry);
    }

    const finished = totals.completed + totals.noShow;
    const noShowRatePct = finished > 0 ? Math.round((totals.noShow / finished) * 100) : 0;

    const upcomingCount = await tx.booking.count({
      where: {
        deletedAt: null,
        startAt: { gt: new Date(nowUtc) },
        status: { notIn: TERMINAL },
      },
    });

    const topServices = [...byService.values()].sort((a, b) => b.count - a.count).slice(0, 8);

    return {
      from: query.from,
      to: query.to,
      totals,
      noShowRatePct,
      revenueCents,
      upcomingCount,
      topServices,
    };
  });
}
