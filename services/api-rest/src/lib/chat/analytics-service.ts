// Live Chat — analytics / reporting reads (docs/56, docs/97 §5).
//
// LIVE aggregates over chat_conversations + chat_messages (no rollup table —
// conversation volume is low and every query rides an existing index). Powers
// the Chat overview's reporting surfaces: the volume timeseries, the AI-vs-human
// resolution split, channel mix, agent performance, and the activity feed. CSAT
// has no backing model yet (no rating capture) — it stays sample on the overview
// (workload B, docs/97 §4). Every call rides withTenant so RLS scopes to the
// caller's tenant.
//
// Resolution classification: a conversation RESOLVED with no staff message was
// handled by AI / self-service ("ai-resolved"); one with ≥1 staff message is
// "human-resolved". First-response latency is the gap from a conversation's
// creation to its first non-customer (staff or AI) message.

import { withTenant, type TenantContext } from '@sparx/db';

import { firstNonEmpty } from './types.js';

// ── UTC-day helpers (live-aggregate twin of the rollup timeseries, docs/97) ──
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

export type ChatGrain = 'day' | 'week' | 'month';

export interface ChatRangeInput {
  from?: string;
  to?: string;
}

interface ResolvedRange {
  from: Date;
  to: Date;
  toExclusive: Date;
}

function resolveRange(range: ChatRangeInput, defaultDays = 30): ResolvedRange {
  const to = startOfUtcDay(range.to ? new Date(range.to) : new Date());
  const from = startOfUtcDay(
    range.from ? new Date(range.from) : addUtcDays(to, -(defaultDays - 1))
  );
  return { from, to, toExclusive: addUtcDays(to, 1) };
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── Summary ──────────────────────────────────────────────────────────
// Conversation/channel/status snapshot + windowed started, resolved (with the
// AI-vs-human split) and average first-response latency.

const CHAT_STATUSES = ['open', 'pending', 'resolved', 'spam'] as const;
type ChatStatus = (typeof CHAT_STATUSES)[number];

export interface ChatSummary {
  rangeLabel: string;
  startedInRange: number;
  resolvedInRange: number;
  openNow: number;
  avgFirstResponseSeconds: number | null;
  aiResolved: number;
  humanResolved: number;
  aiHandledPct: number | null;
  byStatus: Record<ChatStatus, number>;
  byChannel: { source: string; count: number }[];
}

interface RawStartedRow {
  started: number;
  avg_first_response_seconds: unknown;
}
interface RawResolvedRow {
  resolved: number;
  ai_resolved: number;
  human_resolved: number;
}

export async function summary(ctx: TenantContext, range: ChatRangeInput): Promise<ChatSummary> {
  const { from, toExclusive } = resolveRange(range);

  return withTenant(ctx, async (tx) => {
    const [startedRows, resolvedRows, statusGroups, channelGroups] = await Promise.all([
      tx.$queryRaw<RawStartedRow[]>`
        WITH convos AS (
          SELECT id, created_at FROM chat_conversations
          WHERE created_at >= ${from} AND created_at < ${toExclusive}
        ),
        fr AS (
          SELECT conversation_id, MIN(created_at) AS first_response_at
          FROM chat_messages
          WHERE conversation_id IN (SELECT id FROM convos) AND sender_type <> 'customer'
          GROUP BY conversation_id
        )
        SELECT
          COUNT(*)::int AS started,
          AVG(EXTRACT(EPOCH FROM (fr.first_response_at - c.created_at)))
            FILTER (WHERE fr.first_response_at IS NOT NULL AND fr.first_response_at >= c.created_at)
            AS avg_first_response_seconds
        FROM convos c LEFT JOIN fr ON fr.conversation_id = c.id
      `,
      tx.$queryRaw<RawResolvedRow[]>`
        WITH convos AS (
          SELECT id FROM chat_conversations
          WHERE resolved_at >= ${from} AND resolved_at < ${toExclusive} AND status = 'resolved'
        ),
        sc AS (
          SELECT conversation_id, COUNT(*) FILTER (WHERE sender_type = 'staff') AS staff_msgs
          FROM chat_messages WHERE conversation_id IN (SELECT id FROM convos)
          GROUP BY conversation_id
        )
        SELECT
          COUNT(*)::int AS resolved,
          COUNT(*) FILTER (WHERE COALESCE(sc.staff_msgs, 0) = 0)::int AS ai_resolved,
          COUNT(*) FILTER (WHERE COALESCE(sc.staff_msgs, 0) > 0)::int AS human_resolved
        FROM convos c LEFT JOIN sc ON sc.conversation_id = c.id
      `,
      tx.chatConversation.groupBy({ by: ['status'], _count: { _all: true } }),
      tx.chatConversation.groupBy({
        by: ['source'],
        where: { createdAt: { gte: from, lt: toExclusive } },
        _count: { _all: true },
      }),
    ]);

    const byStatus = Object.fromEntries(CHAT_STATUSES.map((s) => [s, 0])) as Record<
      ChatStatus,
      number
    >;
    for (const g of statusGroups) {
      if ((CHAT_STATUSES as readonly string[]).includes(g.status)) {
        byStatus[g.status as ChatStatus] = g._count._all;
      }
    }

    const byChannel = channelGroups
      .map((g) => ({ source: g.source, count: g._count._all }))
      .sort((a, b) => b.count - a.count);

    const s = startedRows[0] ?? { started: 0, avg_first_response_seconds: null };
    const r = resolvedRows[0] ?? { resolved: 0, ai_resolved: 0, human_resolved: 0 };
    const resolvedClassified = Number(r.ai_resolved) + Number(r.human_resolved);

    return {
      rangeLabel: `${utcDateKey(from)} → ${utcDateKey(addUtcDays(toExclusive, -1))}`,
      startedInRange: Number(s.started),
      resolvedInRange: Number(r.resolved),
      openNow: byStatus.open + byStatus.pending,
      avgFirstResponseSeconds: numOrNull(s.avg_first_response_seconds),
      aiResolved: Number(r.ai_resolved),
      humanResolved: Number(r.human_resolved),
      aiHandledPct:
        resolvedClassified > 0 ? +(Number(r.ai_resolved) / resolvedClassified).toFixed(4) : null,
      byStatus,
      byChannel,
    };
  });
}

// ── Volume timeseries ────────────────────────────────────────────────
// Conversations started (by created_at) + resolved (by resolved_at) per bucket,
// zero-filled and grain-folded to match the dashboard chart kit.

export interface ChatTimeseriesPoint {
  bucket: string;
  started: number;
  resolved: number;
}

export interface ChatTimeseries {
  range: { from: string; to: string; grain: ChatGrain };
  points: ChatTimeseriesPoint[];
  totals: { started: number; resolved: number };
}

interface RawDayCount {
  bucket: Date;
  n: number;
}

export async function timeseries(
  ctx: TenantContext,
  input: ChatRangeInput & { grain?: ChatGrain }
): Promise<ChatTimeseries> {
  const grain = input.grain ?? 'day';
  const { from, to, toExclusive } = resolveRange(input);

  return withTenant(ctx, async (tx) => {
    const [startedRows, resolvedRows] = await Promise.all([
      tx.$queryRaw<RawDayCount[]>`
        SELECT (created_at AT TIME ZONE 'UTC')::date AS bucket, COUNT(*)::int AS n
        FROM chat_conversations
        WHERE created_at >= ${from} AND created_at < ${toExclusive}
        GROUP BY 1 ORDER BY 1
      `,
      tx.$queryRaw<RawDayCount[]>`
        SELECT (resolved_at AT TIME ZONE 'UTC')::date AS bucket, COUNT(*)::int AS n
        FROM chat_conversations
        WHERE resolved_at IS NOT NULL AND resolved_at >= ${from} AND resolved_at < ${toExclusive}
        GROUP BY 1 ORDER BY 1
      `,
    ]);

    const startedByKey = new Map<string, number>();
    for (const row of startedRows)
      startedByKey.set(utcDateKey(startOfUtcDay(new Date(row.bucket))), Number(row.n ?? 0));
    const resolvedByKey = new Map<string, number>();
    for (const row of resolvedRows)
      resolvedByKey.set(utcDateKey(startOfUtcDay(new Date(row.bucket))), Number(row.n ?? 0));

    const daily: ChatTimeseriesPoint[] = eachUtcDay(from, to).map((d) => {
      const key = utcDateKey(d);
      return {
        bucket: key,
        started: startedByKey.get(key) ?? 0,
        resolved: resolvedByKey.get(key) ?? 0,
      };
    });

    let points = daily;
    if (grain !== 'day') {
      const map = new Map<string, ChatTimeseriesPoint>();
      for (const p of daily) {
        const key = bucketStartFor(p.bucket, grain);
        const cur = map.get(key);
        if (cur) {
          cur.started += p.started;
          cur.resolved += p.resolved;
        } else {
          map.set(key, { ...p, bucket: key });
        }
      }
      points = [...map.values()].sort((a, b) => (a.bucket < b.bucket ? -1 : 1));
    }

    return {
      range: { from: utcDateKey(from), to: utcDateKey(to), grain },
      points,
      totals: {
        started: daily.reduce((sum, p) => sum + p.started, 0),
        resolved: daily.reduce((sum, p) => sum + p.resolved, 0),
      },
    };
  });
}

// ── Agent performance ────────────────────────────────────────────────
// Each conversation's FIRST responder (staff or AI), grouped: conversations
// handled + average response latency. AI messages carry a null sender_id, so
// they fold into one "AI assistant" row.

export interface ChatAgentRow {
  kind: 'staff' | 'ai';
  id: string | null;
  name: string;
  handled: number;
  avgResponseSeconds: number | null;
}

interface RawAgentRow {
  sender_type: string;
  sender_id: string | null;
  handled: number;
  avg_response_seconds: unknown;
}

export async function agentPerformance(
  ctx: TenantContext,
  range: ChatRangeInput
): Promise<ChatAgentRow[]> {
  const { from, toExclusive } = resolveRange(range);

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<RawAgentRow[]>`
      WITH fr AS (
        SELECT DISTINCT ON (m.conversation_id)
          m.conversation_id, m.sender_type, m.sender_id,
          m.created_at AS resp_at, c.created_at AS conv_at
        FROM chat_messages m
        JOIN chat_conversations c ON c.id = m.conversation_id
        WHERE m.sender_type <> 'customer'
          AND c.created_at >= ${from} AND c.created_at < ${toExclusive}
        ORDER BY m.conversation_id, m.created_at ASC
      )
      SELECT
        sender_type,
        sender_id,
        COUNT(*)::int AS handled,
        AVG(EXTRACT(EPOCH FROM (resp_at - conv_at))) FILTER (WHERE resp_at >= conv_at)
          AS avg_response_seconds
      FROM fr
      GROUP BY sender_type, sender_id
      ORDER BY handled DESC
    `;

    const staffIds = rows.flatMap((row) =>
      row.sender_type === 'staff' && row.sender_id ? [row.sender_id] : []
    );
    const users =
      staffIds.length > 0
        ? await tx.user.findMany({
            where: { id: { in: staffIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const nameById = new Map(users.map((u) => [u.id, u.name ?? u.email]));

    return rows.map((row) => ({
      kind: row.sender_type === 'ai' ? ('ai' as const) : ('staff' as const),
      id: row.sender_id,
      name:
        row.sender_type === 'ai'
          ? 'AI assistant'
          : (nameById.get(row.sender_id ?? '') ?? 'Unknown agent'),
      handled: Number(row.handled),
      avgResponseSeconds: numOrNull(row.avg_response_seconds),
    }));
  });
}

// ── Activity feed ────────────────────────────────────────────────────
// The most recent messages, newest first, with the conversation's
// customer/visitor name — a lifecycle feed for the overview timeline.

export interface ChatActivityItem {
  id: string;
  conversationId: string;
  senderType: string;
  aiGenerated: boolean;
  who: string;
  snippet: string;
  createdAt: string;
}

function contactName(conv: {
  visitorName: string | null;
  visitorEmail: string | null;
  customer: { firstName: string | null; lastName: string | null; company: string | null } | null;
}): string {
  if (conv.customer) {
    const full = [conv.customer.firstName, conv.customer.lastName].filter(Boolean).join(' ').trim();
    return firstNonEmpty(full, conv.customer.company) ?? 'Anonymous visitor';
  }
  return firstNonEmpty(conv.visitorName, conv.visitorEmail) ?? 'Anonymous visitor';
}

export async function activity(ctx: TenantContext, limit = 12): Promise<ChatActivityItem[]> {
  const take = Math.min(Math.max(limit, 1), 50);
  return withTenant(ctx, async (tx) => {
    const messages = await tx.chatMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        conversationId: true,
        senderType: true,
        aiGenerated: true,
        body: true,
        createdAt: true,
        conversation: {
          select: {
            visitorName: true,
            visitorEmail: true,
            customer: { select: { firstName: true, lastName: true, company: true } },
          },
        },
      },
    });

    return messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderType: m.senderType,
      aiGenerated: m.aiGenerated,
      who: contactName(m.conversation),
      snippet: m.body.slice(0, 140),
      createdAt: m.createdAt.toISOString(),
    }));
  });
}
