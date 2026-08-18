// AI — reporting reads (docs/07, docs/97 §5).
//
//   GET /v1/ai/reports/summary?from=&to=
//     → MCP requests + success/error split + success rate + distinct tools,
//       API-key counts, automation runs, and the combined "AI actions" total
//   GET /v1/ai/reports/timeseries?from=&to=&grain=day|week|month
//     → MCP requests per bucket (with the error sub-count)
//   GET /v1/ai/reports/top-tools?from=&to=&limit=
//     → most-called MCP tools with their error counts
//   GET /v1/ai/reports/activity?limit=
//     → most recent MCP tool calls (the AI activity feed)
//
// LIVE aggregates over `audit_logs` — every MCP tool call already lands there
// with entity_type='McpToolCall', action='mcp.<tool>', diff={input,outcome}
// (wizeworks/services/api-mcp/src/audit.ts), so MCP usage is fully derivable with no new
// capture. What we genuinely CANNOT see is the client-side LLM spend: the
// agent's model/token/cost lives in the caller's LLM account, never ours — so
// the overview's token/cost/model-mix stays sample (workload B, docs/97 §4).
//
// Viewer-read, AI-module-gated, tenant-scoped via withRequestTenant (RLS).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';

import { requireAiModule } from '../../../lib/ai-context.js';

const MCP_ENTITY = 'McpToolCall';

const RangeQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
const TimeseriesQuery = RangeQuery.extend({
  grain: z.enum(['day', 'week', 'month']).optional(),
});
const TopToolsQuery = RangeQuery.extend({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
const ActivityQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

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

function resolveRange(input: { from?: string; to?: string }, defaultDays = 30) {
  const to = startOfUtcDay(input.to ? new Date(input.to) : new Date());
  const from = startOfUtcDay(
    input.from ? new Date(input.from) : addUtcDays(to, -(defaultDays - 1))
  );
  return { from, to, toExclusive: addUtcDays(to, 1) };
}

// Strip the `mcp.` action prefix to the bare tool name.
function toolName(action: string): string {
  return action.startsWith('mcp.') ? action.slice(4) : action;
}

interface RawMcpSummary {
  total: number;
  success: number;
  error: number;
  unique_tools: number;
}
interface RawMcpDay {
  bucket: Date;
  total: number;
  errors: number;
}
interface RawToolRow {
  action: string;
  calls: number;
  errors: number;
}

const aiReportRoutes: FastifyPluginAsync = (app) => {
  // ── Summary: MCP usage + API keys + automation runs + AI-actions total ──
  app.get('/v1/ai/reports/summary', async (request) => {
    requireRole(request, 'viewer');
    await requireAiModule(request);
    const { from, toExclusive } = resolveRange(RangeQuery.parse(request.query));

    return withRequestTenant(request, async (tx) => {
      const [mcpRows, apiKeysActive, apiKeysTotal, automationRuns] = await Promise.all([
        tx.$queryRaw<RawMcpSummary[]>`
          SELECT
            COUNT(*)::int                                            AS total,
            COUNT(*) FILTER (WHERE diff->>'outcome' = 'success')::int AS success,
            COUNT(*) FILTER (WHERE diff->>'outcome' = 'error')::int   AS error,
            COUNT(DISTINCT action)::int                              AS unique_tools
          FROM audit_logs
          WHERE entity_type = ${MCP_ENTITY}
            AND created_at >= ${from} AND created_at < ${toExclusive}
        `,
        tx.apiKey.count({ where: { revokedAt: null } }),
        tx.apiKey.count(),
        tx.automationRun.count({ where: { startedAt: { gte: from, lt: toExclusive } } }),
      ]);

      const m = mcpRows[0] ?? { total: 0, success: 0, error: 0, unique_tools: 0 };
      const mcpRequests = Number(m.total);
      const mcpSuccess = Number(m.success);
      const mcpError = Number(m.error);
      const classified = mcpSuccess + mcpError;

      return ok({
        mcpRequests,
        mcpSuccess,
        mcpError,
        successRate: classified > 0 ? +(mcpSuccess / classified).toFixed(4) : null,
        uniqueTools: Number(m.unique_tools),
        apiKeysActive,
        apiKeysTotal,
        automationRuns,
        // The AI surfaces we actually capture: MCP tool calls + automation runs.
        aiActions: mcpRequests + automationRuns,
      });
    });
  });

  // ── Timeseries: MCP requests per bucket (with error sub-count) ──
  app.get('/v1/ai/reports/timeseries', async (request) => {
    requireRole(request, 'viewer');
    await requireAiModule(request);
    const q = TimeseriesQuery.parse(request.query);
    const grain = q.grain ?? 'day';
    const { from, to, toExclusive } = resolveRange(q);

    return withRequestTenant(request, async (tx) => {
      const rows = await tx.$queryRaw<RawMcpDay[]>`
        SELECT
          (created_at AT TIME ZONE 'UTC')::date                    AS bucket,
          COUNT(*)::int                                            AS total,
          COUNT(*) FILTER (WHERE diff->>'outcome' = 'error')::int  AS errors
        FROM audit_logs
        WHERE entity_type = ${MCP_ENTITY}
          AND created_at >= ${from} AND created_at < ${toExclusive}
        GROUP BY 1 ORDER BY 1
      `;

      const byKey = new Map<string, { requests: number; errors: number }>();
      for (const r of rows) {
        byKey.set(utcDateKey(startOfUtcDay(new Date(r.bucket))), {
          requests: Number(r.total ?? 0),
          errors: Number(r.errors ?? 0),
        });
      }

      const daily = eachUtcDay(from, to).map((d) => {
        const key = utcDateKey(d);
        const v = byKey.get(key);
        return { bucket: key, requests: v?.requests ?? 0, errors: v?.errors ?? 0 };
      });

      let points = daily;
      if (grain !== 'day') {
        const map = new Map<string, { bucket: string; requests: number; errors: number }>();
        for (const p of daily) {
          const key = bucketStartFor(p.bucket, grain);
          const cur = map.get(key);
          if (cur) {
            cur.requests += p.requests;
            cur.errors += p.errors;
          } else {
            map.set(key, { ...p, bucket: key });
          }
        }
        points = [...map.values()].sort((a, b) => (a.bucket < b.bucket ? -1 : 1));
      }

      return ok({
        range: { from: utcDateKey(from), to: utcDateKey(to), grain },
        points,
        totals: {
          requests: daily.reduce((s, p) => s + p.requests, 0),
          errors: daily.reduce((s, p) => s + p.errors, 0),
        },
      });
    });
  });

  // ── Top tools: most-called MCP tools with error counts ──
  app.get('/v1/ai/reports/top-tools', async (request) => {
    requireRole(request, 'viewer');
    await requireAiModule(request);
    const q = TopToolsQuery.parse(request.query);
    const limit = q.limit ?? 8;
    const { from, toExclusive } = resolveRange(q);

    return withRequestTenant(request, async (tx) => {
      const rows = await tx.$queryRaw<RawToolRow[]>`
        SELECT
          action,
          COUNT(*)::int                                           AS calls,
          COUNT(*) FILTER (WHERE diff->>'outcome' = 'error')::int AS errors
        FROM audit_logs
        WHERE entity_type = ${MCP_ENTITY}
          AND created_at >= ${from} AND created_at < ${toExclusive}
        GROUP BY action
        ORDER BY calls DESC
        LIMIT ${limit}
      `;

      return ok(
        rows.map((r) => {
          const calls = Number(r.calls);
          const errors = Number(r.errors);
          return {
            tool: toolName(r.action),
            calls,
            errors,
            successRate: calls > 0 ? +((calls - errors) / calls).toFixed(4) : null,
          };
        })
      );
    });
  });

  // ── Activity: recent MCP tool calls ──
  app.get('/v1/ai/reports/activity', async (request) => {
    requireRole(request, 'viewer');
    await requireAiModule(request);
    const take = ActivityQuery.parse(request.query).limit ?? 12;

    return withRequestTenant(request, async (tx) => {
      const rows = await tx.auditLog.findMany({
        where: { entityType: MCP_ENTITY },
        orderBy: { createdAt: 'desc' },
        take,
        select: { id: true, action: true, actorId: true, diff: true, createdAt: true },
      });

      return ok(
        rows.map((r) => {
          const diff = (r.diff ?? {}) as { outcome?: string };
          return {
            id: r.id,
            tool: toolName(r.action),
            actorId: r.actorId,
            outcome: diff.outcome ?? 'success',
            createdAt: r.createdAt.toISOString(),
          };
        })
      );
    });
  });

  return Promise.resolve();
};

export default aiReportRoutes;
