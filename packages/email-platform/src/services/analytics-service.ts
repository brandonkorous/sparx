// analyticsService — engagement rollups from the append-only EmailEvent log.
//
// The overview powers the Email module's landing tiles + recent activity.
// Per-broadcast stats live on broadcastService.stats; per-automation rollups
// are here for the automations surface + MCP.

import { withTenant } from '@sparx/db';
import type { ServiceContext } from '../errors';

export interface EngagementCounts {
  accepted: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  failed: number;
}

export interface RecentEvent {
  type: string;
  recipient: string;
  occurredAt: string;
  broadcastId: string | null;
  automationKey: string | null;
}

export interface OverviewResult {
  days: number;
  counts: EngagementCounts;
  suppressedTotal: number;
  recent: RecentEvent[];
}

function emptyCounts(): EngagementCounts {
  return {
    accepted: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    complained: 0,
    unsubscribed: 0,
    failed: 0,
  };
}

function applyGroups(
  counts: EngagementCounts,
  rows: { type: string; _count: { _all: number } }[]
): EngagementCounts {
  for (const r of rows) {
    if (r.type in counts) counts[r.type as keyof EngagementCounts] = r._count._all;
  }
  return counts;
}

export async function overview(ctx: ServiceContext, days = 30): Promise<OverviewResult> {
  const since = new Date(Date.now() - days * 86400 * 1000);
  return withTenant(ctx, async (tx) => {
    const [groups, suppressedTotal, recentRows] = await Promise.all([
      tx.emailEvent.groupBy({
        by: ['type'],
        where: { occurredAt: { gte: since } },
        _count: { _all: true },
      }),
      tx.emailSuppression.count(),
      tx.emailEvent.findMany({
        orderBy: { occurredAt: 'desc' },
        take: 15,
        select: {
          type: true,
          recipient: true,
          occurredAt: true,
          broadcastId: true,
          automationKey: true,
        },
      }),
    ]);

    return {
      days,
      counts: applyGroups(emptyCounts(), groups),
      suppressedTotal,
      recent: recentRows.map((r) => ({
        type: r.type,
        recipient: r.recipient,
        occurredAt: r.occurredAt.toISOString(),
        broadcastId: r.broadcastId,
        automationKey: r.automationKey,
      })),
    };
  });
}

export async function automationStats(
  ctx: ServiceContext,
  automationKey: string,
  days = 30
): Promise<EngagementCounts> {
  const since = new Date(Date.now() - days * 86400 * 1000);
  const groups = await withTenant(ctx, (tx) =>
    tx.emailEvent.groupBy({
      by: ['type'],
      where: { automationKey, occurredAt: { gte: since } },
      _count: { _all: true },
    })
  );
  return applyGroups(emptyCounts(), groups);
}

// ─── Subscriber / list growth (live aggregate, docs/97) ──────────────
//
// The email module has no dedicated subscriber table — the audience IS the CRM
// customer base (customers with an email), and unsubscribes/bounces live in
// `email_suppressions`. So list growth is derived: contacts ADDED (customers
// created with an email) minus REMOVED (marketing/all suppressions created) per
// UTC day. `currentSubscribers` is the live mailable list — customers with an
// email that isn't suppressed for marketing. Live aggregate over the operational
// tables. Revenue attribution is NOT here: tying an order back to an email click
// needs conversion event capture (workload B, docs/97 §4).

type GrowthGrain = 'day' | 'week' | 'month';

export interface SubscriberGrowthPoint {
  bucket: string;
  added: number;
  removed: number;
  net: number;
}
export interface SubscriberGrowth {
  range: { from: string; to: string; grain: GrowthGrain };
  points: SubscriberGrowthPoint[];
  totals: { added: number; removed: number; net: number };
  currentSubscribers: number;
}

interface RawCountDay {
  bucket: Date;
  n: number;
}

function growthStartOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function growthAddDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
function growthDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function growthBucketStart(dateKey: string, grain: 'week' | 'month'): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  if (grain === 'month') {
    return growthDateKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  }
  const deltaToMonday = (d.getUTCDay() + 6) % 7;
  return growthDateKey(growthAddDays(growthStartOfUtcDay(d), -deltaToMonday));
}

export async function subscriberGrowth(
  ctx: ServiceContext,
  input?: { range?: { from: string; to: string }; grain?: GrowthGrain }
): Promise<SubscriberGrowth> {
  const grain = input?.grain ?? 'day';
  const to = growthStartOfUtcDay(input?.range ? new Date(input.range.to) : new Date());
  const from = growthStartOfUtcDay(
    input?.range ? new Date(input.range.from) : growthAddDays(to, -29)
  );
  const toExclusive = growthAddDays(to, 1);

  return withTenant(ctx, async (tx) => {
    const [addedRows, removedRows, currentRows] = await Promise.all([
      tx.$queryRaw<RawCountDay[]>`
        SELECT (created_at AT TIME ZONE 'UTC')::date AS bucket, COUNT(*)::int AS n
        FROM customers
        WHERE deleted_at IS NULL AND email IS NOT NULL
          AND created_at >= ${from} AND created_at < ${toExclusive}
        GROUP BY 1
      `,
      tx.$queryRaw<RawCountDay[]>`
        SELECT (created_at AT TIME ZONE 'UTC')::date AS bucket, COUNT(*)::int AS n
        FROM email_suppressions
        WHERE scope IN ('marketing', 'all')
          AND created_at >= ${from} AND created_at < ${toExclusive}
        GROUP BY 1
      `,
      tx.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*)::int AS n
        FROM customers c
        WHERE c.deleted_at IS NULL AND c.email IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM email_suppressions s
            WHERE lower(s.email) = lower(c.email) AND s.scope IN ('marketing', 'all')
          )
      `,
    ]);

    const addedByKey = new Map<string, number>();
    for (const r of addedRows)
      addedByKey.set(growthDateKey(growthStartOfUtcDay(new Date(r.bucket))), Number(r.n ?? 0));
    const removedByKey = new Map<string, number>();
    for (const r of removedRows)
      removedByKey.set(growthDateKey(growthStartOfUtcDay(new Date(r.bucket))), Number(r.n ?? 0));

    const daily: SubscriberGrowthPoint[] = [];
    for (let d = from; d.getTime() <= to.getTime(); d = growthAddDays(d, 1)) {
      const key = growthDateKey(d);
      const added = addedByKey.get(key) ?? 0;
      const removed = removedByKey.get(key) ?? 0;
      daily.push({ bucket: key, added, removed, net: added - removed });
    }

    let points = daily;
    if (grain !== 'day') {
      const map = new Map<string, SubscriberGrowthPoint>();
      for (const p of daily) {
        const key = growthBucketStart(p.bucket, grain);
        const cur = map.get(key);
        if (cur) {
          cur.added += p.added;
          cur.removed += p.removed;
          cur.net += p.net;
        } else {
          map.set(key, { ...p, bucket: key });
        }
      }
      points = [...map.values()].sort((a, b) => (a.bucket < b.bucket ? -1 : 1));
    }

    const totals = daily.reduce(
      (acc, p) => ({
        added: acc.added + p.added,
        removed: acc.removed + p.removed,
        net: acc.net + p.net,
      }),
      { added: 0, removed: 0, net: 0 }
    );

    return {
      range: { from: growthDateKey(from), to: growthDateKey(to), grain },
      points,
      totals,
      currentSubscribers: Number(currentRows[0]?.n ?? 0),
    };
  });
}
