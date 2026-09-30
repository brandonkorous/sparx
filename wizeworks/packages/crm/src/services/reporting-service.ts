// CRM reporting service — the report queries that back the dashboard
// reports page and the MCP get_crm_metrics tool.
//
// For now these are live queries against the source tables. A nightly
// rollup into crm_metrics_daily (docs/11 Phase 6) is a follow-up — the
// query shape stays the same so swapping the data source later is a
// one-place change.

import { withTenant } from '@wizeworks/db';
import { channelKeyLabel } from '@wizeworks/crm-schemas';

import type { ServiceContext } from '../errors';

export interface PipelineFunnelBucket {
  stageId: string;
  stageName: string;
  stageType: string;
  count: number;
  totalValue: number;
}

export interface WinLossRow {
  repId: string | null;
  won: number;
  lost: number;
  open: number;
  winRate: number; // won / (won + lost), 0–1
  totalWonValue: number;
}

export interface RepPerformanceRow {
  repId: string;
  dealsOpened: number;
  dealsWon: number;
  revenue: number;
  tasksCompleted: number;
  quotesSent: number;
  quotesAccepted: number;
}

export interface AcquisitionPoint {
  month: string; // yyyy-mm
  newCustomers: number;
}

/** Pipeline funnel — deal counts + summed value per stage for one pipeline. */
export async function pipelineFunnel(
  ctx: ServiceContext,
  pipelineId: string
): Promise<PipelineFunnelBucket[]> {
  return withTenant(ctx, async (tx) => {
    const stages = await tx.pipelineStage.findMany({
      where: { pipelineId },
      orderBy: { sortOrder: 'asc' },
    });
    const buckets: PipelineFunnelBucket[] = [];
    for (const stage of stages) {
      const deals = await tx.deal.findMany({
        where: { pipelineId, stageId: stage.id, deletedAt: null },
        select: { value: true },
      });
      buckets.push({
        stageId: stage.id,
        stageName: stage.name,
        stageType: stage.stageType,
        count: deals.length,
        totalValue: deals.reduce((s, d) => s + Number(d.value), 0),
      });
    }
    return buckets;
  });
}

/** Win/loss aggregated by assigned rep. Open deals included so reps see
 *  pipeline alongside closed history. */
export async function winLossByRep(
  ctx: ServiceContext,
  args: { since?: Date; pipelineId?: string } = {}
): Promise<WinLossRow[]> {
  return withTenant(ctx, async (tx) => {
    const deals = await tx.deal.findMany({
      where: {
        deletedAt: null,
        ...(args.pipelineId ? { pipelineId: args.pipelineId } : {}),
        ...(args.since ? { updatedAt: { gte: args.since } } : {}),
      },
      include: { stage: true },
    });

    const byRep = new Map<string | null, WinLossRow>();
    for (const d of deals) {
      const rep = d.assignedRepId;
      const row =
        byRep.get(rep) ??
        ({
          repId: rep,
          won: 0,
          lost: 0,
          open: 0,
          winRate: 0,
          totalWonValue: 0,
        } satisfies WinLossRow);
      if (d.stage.stageType === 'won') {
        row.won += 1;
        row.totalWonValue += Number(d.value);
      } else if (d.stage.stageType === 'lost') {
        row.lost += 1;
      } else {
        row.open += 1;
      }
      byRep.set(rep, row);
    }
    return [...byRep.values()].map((r) => ({
      ...r,
      winRate: r.won + r.lost > 0 ? r.won / (r.won + r.lost) : 0,
    }));
  });
}

/** Customer acquisition by month — count of customers created in each
 *  bucket over the trailing window. */
export async function acquisitionByMonth(
  ctx: ServiceContext,
  args: { months?: number } = {}
): Promise<AcquisitionPoint[]> {
  const months = Math.min(args.months ?? 12, 36);
  const horizon = new Date();
  horizon.setUTCMonth(horizon.getUTCMonth() - months);
  horizon.setUTCDate(1);

  return withTenant(ctx, async (tx) => {
    const customers = await tx.customer.findMany({
      where: { deletedAt: null, createdAt: { gte: horizon } },
      select: { createdAt: true },
    });
    const counts = new Map<string, number>();
    for (let i = 0; i <= months; i++) {
      const d = new Date(horizon.getTime());
      d.setUTCMonth(d.getUTCMonth() + i);
      counts.set(monthKey(d), 0);
    }
    for (const c of customers) {
      const key = monthKey(c.createdAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([month, newCustomers]) => ({ month, newCustomers }))
      .sort((a, b) => a.month.localeCompare(b.month));
  });
}

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${y}-${m}`;
}

/** Overall CRM metrics snapshot for the reports landing page. */
export async function tenantSnapshot(ctx: ServiceContext): Promise<{
  customers: number;
  companies: number;
  openDeals: number;
  pipelineValue: number;
  openTasks: number;
  overdueTasks: number;
  activeSegments: number;
}> {
  return withTenant(ctx, async (tx) => {
    const now = new Date();
    const [
      customers,
      companies,
      openDeals,
      openDealsValue,
      openTasks,
      overdueTasks,
      activeSegments,
    ] = await Promise.all([
      tx.customer.count({ where: { deletedAt: null } }),
      tx.company.count({ where: { deletedAt: null } }),
      tx.deal.count({ where: { deletedAt: null, closedAt: null } }),
      tx.deal.aggregate({
        where: { deletedAt: null, closedAt: null },
        _sum: { value: true },
      }),
      tx.task.count({ where: { status: 'open' } }),
      tx.task.count({ where: { status: 'open', dueAt: { not: null, lt: now } } }),
      tx.segment.count({ where: { archivedAt: null } }),
    ]);

    return {
      customers,
      companies,
      openDeals,
      pipelineValue: Number(openDealsValue._sum.value ?? 0),
      openTasks,
      overdueTasks,
      activeSegments,
    };
  });
}

// ─── Leads by source (live aggregate, docs/97) ───────────────────────
//
// The CRM has no structured `source` column, so this reads a customer's FIRST
// ORDER's channel — storefront, b2b_portal, admin, import, mcp, or the
// marketplace they arrived through. That is an observation.
//
// ── A CUSTOMER WITH NO ORDER IS NOT A SOURCE ────────────────────────────────
//
// This used to fall back to 'b2b_portal' when the customer was attached to a
// company, and to 'direct' otherwise. Neither is evidence: a company link says
// what KIND of customer somebody is, not how they arrived, and 'direct' is a
// real-sounding channel name for "we never found out".
//
// Measured on the dev database 2026-09-25, across every tenant:
//
//     has a first order  ..................  59   (a real answer)
//     no order, attached to a company .....   8   (was reported "B2B portal")
//     no order, no company  ............... 678   (was reported "Direct")
//
// 686 of 745 — 92% — were answered with a guess, under a panel headed "Where
// new customers come from". The guess is gone. A customer with no order keys
// as `none`, which is not an order channel and never will be.
// [[feedback_never_present_absence_as_measurement]]
//
// ── THE LABELS COME FROM THE ORDER-CHANNEL TABLE, NOT A COPY OF IT ──────────
//
// A second copy of `ORDER_CHANNEL_LABELS` lived here and went stale the moment
// `marketplace` was added to the channel set: three marketplace customers read
// the raw key `marketplace`, lowercase, on screen. One table, one place.
//
// Live aggregate; the per-customer first-order lookup rides the orders
// `(tenant, customer, placed_at)` index.

const LEADS_DEFAULT_DAYS = 90;

/** The key for a customer who has never ordered. Deliberately NOT an order
 *  channel, so no report can print it as though it were one. */
export const LEAD_SOURCE_NONE = 'none';

export function leadSourceLabel(key: string): string {
  return key === LEAD_SOURCE_NONE ? 'No order yet' : channelKeyLabel(key);
}

export interface LeadSourceRow {
  source: string;
  label: string;
  count: number;
  sharePct: number;
}
export interface LeadsBySource {
  rangeLabel: string;
  totalLeads: number;
  bySource: LeadSourceRow[];
}

interface RawSourceRow {
  source: string;
  leads: number;
}

export async function leadsBySource(
  ctx: ServiceContext,
  input?: { range?: { from: string; to: string } }
): Promise<LeadsBySource> {
  const to = input?.range ? new Date(input.range.to) : new Date();
  const from = input?.range
    ? new Date(input.range.from)
    : new Date(Date.now() - LEADS_DEFAULT_DAYS * 86_400_000);
  const label = input?.range
    ? `${input.range.from.slice(0, 10)} → ${input.range.to.slice(0, 10)}`
    : `Last ${LEADS_DEFAULT_DAYS} days`;

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<RawSourceRow[]>`
      SELECT
        COALESCE(
          (SELECT CASE WHEN o.channel = 'marketplace'
                       THEN COALESCE(o.source, 'marketplace')
                       ELSE o.channel END
             FROM orders o
             WHERE o.customer_id = c.id
             ORDER BY o.placed_at ASC LIMIT 1),
          ${LEAD_SOURCE_NONE}
        ) AS source,
        COUNT(*)::int AS leads
      FROM customers c
      WHERE c.deleted_at IS NULL
        AND c.created_at >= ${from}
        AND c.created_at <= ${to}
      GROUP BY 1
      ORDER BY leads DESC
    `;

    const totalLeads = rows.reduce((s, r) => s + Number(r.leads ?? 0), 0);
    const bySource: LeadSourceRow[] = rows.map((r) => {
      const count = Number(r.leads ?? 0);
      const source = r.source ?? LEAD_SOURCE_NONE;
      return {
        source,
        label: leadSourceLabel(source),
        count,
        sharePct: totalLeads > 0 ? +((count / totalLeads) * 100).toFixed(1) : 0,
      };
    });

    return { rangeLabel: label, totalLeads, bySource };
  });
}

// ─── Task metrics (live aggregate, docs/97) ──────────────────────────
//
// Aggregate task health across the whole tenant — open/overdue/due-today
// counts, the open-task priority mix, and recent completions. The per-entity
// `/tasks/overdue` + `/tasks/today` lists can't give this rollup.

export interface TaskMetrics {
  open: number;
  overdue: number;
  dueToday: number;
  completedLast30d: number;
  byPriority: { low: number; medium: number; high: number; urgent: number };
}

export async function taskMetrics(ctx: ServiceContext): Promise<TaskMetrics> {
  return withTenant(ctx, async (tx) => {
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const startOfTomorrow = new Date(startOfToday.getTime() + 86_400_000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

    const [open, overdue, dueToday, completedLast30d, priorityGroups] = await Promise.all([
      tx.task.count({ where: { status: 'open' } }),
      tx.task.count({ where: { status: 'open', dueAt: { not: null, lt: now } } }),
      tx.task.count({
        where: { status: 'open', dueAt: { gte: startOfToday, lt: startOfTomorrow } },
      }),
      tx.task.count({ where: { status: 'completed', completedAt: { gte: thirtyDaysAgo } } }),
      tx.task.groupBy({ by: ['priority'], where: { status: 'open' }, _count: { _all: true } }),
    ]);

    const byPriority = { low: 0, medium: 0, high: 0, urgent: 0 };
    for (const g of priorityGroups) {
      if (g.priority in byPriority) {
        byPriority[g.priority as keyof typeof byPriority] = g._count._all;
      }
    }

    return { open, overdue, dueToday, completedLast30d, byPriority };
  });
}

// ─── Segment summary (live aggregate, docs/97) ───────────────────────
//
// Every active segment with its member count in one call — the cross-segment
// view the per-segment `/segments/:id/member-count` endpoint can't give without
// N round-trips. Member counts come from a single GROUP BY over the membership
// join table.

export interface SegmentSummaryRow {
  id: string;
  name: string;
  memberCount: number;
}
export interface SegmentSummary {
  totalSegments: number;
  totalMembers: number;
  segments: SegmentSummaryRow[];
}

export async function segmentSummary(
  ctx: ServiceContext,
  input?: { limit?: number }
): Promise<SegmentSummary> {
  const limit = Math.min(Math.max(input?.limit ?? 12, 1), 100);

  return withTenant(ctx, async (tx) => {
    const segments = await tx.segment.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });
    if (segments.length === 0) return { totalSegments: 0, totalMembers: 0, segments: [] };

    const counts = await tx.segmentMember.groupBy({
      by: ['segmentId'],
      where: { segmentId: { in: segments.map((s) => s.id) } },
      _count: { _all: true },
    });
    const countById = new Map(counts.map((c) => [c.segmentId, c._count._all]));

    const rows: SegmentSummaryRow[] = segments
      .map((s) => ({ id: s.id, name: s.name, memberCount: countById.get(s.id) ?? 0 }))
      .sort((a, b) => b.memberCount - a.memberCount);

    return {
      totalSegments: rows.length,
      totalMembers: rows.reduce((sum, r) => sum + r.memberCount, 0),
      segments: rows.slice(0, limit),
    };
  });
}
