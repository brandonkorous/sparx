// Internal L-PLAT acquisition report (docs/80 §10). Aggregates the
// `tenants.acquisition_*` columns — written once at signup from the first-party
// attribution cookies — into a channel / source / campaign breakdown so a
// WizeWorks operator can answer "which channels send us paying tenants?".
//
// Auth: shared secret in `X-Sparx-Internal-Acquisition-Token`, constant-time
// compared against env.SPARX_INTERNAL_ACQUISITION_TOKEN. This is a SEPARATE
// secret from the cron token (SPARX_INTERNAL_CRON_TOKEN) on purpose — it exposes
// cross-tenant business intelligence, a different blast radius than triggering a
// scheduler, so it rotates independently and can be handed out without also
// granting cron-trigger access.
//
// Why an internal token endpoint and not a dashboard page: Sparx has no
// staff/operator auth tier (docs/16 §2.4) — every session is pinned to exactly
// one tenant, and the dashboard's data path is RLS-scoped to that tenant. A
// cross-tenant view therefore can't live behind a normal dashboard login today.
// This mirrors the existing /internal/* cron surface: ClusterIP-only, no JWT,
// shared-secret header. A real operator console lands when the platform-admin
// tier in docs/16 §2.4 is built.
//
//   • GET /internal/acquisition/summary                 → JSON breakdown
//   • GET /internal/acquisition/summary?format=csv      → tidy long-format CSV
//   • GET /internal/acquisition/summary?since=…&until=… → window on signup date
//
// The `tenants` table is intentionally non-RLS (the dispatch row), so this reads
// across every tenant with the plain system Prisma client — no tenant context to
// establish. Tenant count is tiny in Phase 1, so one findMany + in-memory
// grouping is correct; revisit with a SQL GROUP BY if the table grows large.

import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { prisma, type Prisma } from '@sparx/db';

import { env } from '../../env.js';

const ACQ_TOKEN_HEADER = 'x-sparx-internal-acquisition-token';

// NULL acquisitionChannel = signed up before attribution shipped, or no touch
// cookie present. Kept distinct from a classified 'direct' touch so the report
// never conflates "we don't know" with "came in typing the URL".
const UNATTRIBUTED = '(unknown)';

function authorize(request: FastifyRequest): void {
  const expected = env.SPARX_INTERNAL_ACQUISITION_TOKEN;
  if (!expected) {
    // No token configured → endpoint is disabled. 401 so a forgotten secret in
    // prod surfaces loudly instead of silently leaking the report.
    throw unauthorized('Internal acquisition token is not configured.');
  }
  const provided = request.headers[ACQ_TOKEN_HEADER];
  if (typeof provided !== 'string' || provided.length === 0) {
    throw unauthorized('Missing X-Sparx-Internal-Acquisition-Token header.');
  }
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw unauthorized('Invalid acquisition token.');
  }
}

interface TenantRow {
  acquisitionChannel: string | null;
  acquisitionSource: string | null;
  acquisitionCampaign: string | null;
  acquiredAt: Date | null;
  status: string;
  stripeCustomerId: string | null;
  createdAt: Date;
}

interface GroupBucket {
  /** Primary key of the group (the channel / source / campaign value). */
  key: string;
  /** Dominant channel for source/campaign rows (most-common among members). */
  channel: string;
  /** Dominant source for campaign rows. */
  source: string;
  tenants: number;
  /** stripeCustomerId set — proxy for "reached billing / converted". */
  withBilling: number;
  /** status === 'active'. */
  active: number;
  firstAcquiredAt: string | null;
  lastAcquiredAt: string | null;
}

/** Accumulates rows into one bucket per `keyOf` value, tracking dominant
 *  channel/source via a per-bucket tally so source/campaign rows can name the
 *  channel they overwhelmingly came through. */
function groupBy(
  rows: TenantRow[],
  keyOf: (r: TenantRow) => string,
  channelOf: (r: TenantRow) => string,
  sourceOf: (r: TenantRow) => string
): GroupBucket[] {
  interface Acc {
    key: string;
    tenants: number;
    withBilling: number;
    active: number;
    firstAcquiredAt: Date | null;
    lastAcquiredAt: Date | null;
    channelTally: Map<string, number>;
    sourceTally: Map<string, number>;
  }
  const acc = new Map<string, Acc>();
  for (const r of rows) {
    const key = keyOf(r);
    let bucket = acc.get(key);
    if (!bucket) {
      bucket = {
        key,
        tenants: 0,
        withBilling: 0,
        active: 0,
        firstAcquiredAt: null,
        lastAcquiredAt: null,
        channelTally: new Map(),
        sourceTally: new Map(),
      };
      acc.set(key, bucket);
    }
    bucket.tenants += 1;
    if (r.stripeCustomerId) bucket.withBilling += 1;
    if (r.status === 'active') bucket.active += 1;
    if (r.acquiredAt) {
      if (!bucket.firstAcquiredAt || r.acquiredAt < bucket.firstAcquiredAt) {
        bucket.firstAcquiredAt = r.acquiredAt;
      }
      if (!bucket.lastAcquiredAt || r.acquiredAt > bucket.lastAcquiredAt) {
        bucket.lastAcquiredAt = r.acquiredAt;
      }
    }
    const ch = channelOf(r);
    bucket.channelTally.set(ch, (bucket.channelTally.get(ch) ?? 0) + 1);
    const src = sourceOf(r);
    bucket.sourceTally.set(src, (bucket.sourceTally.get(src) ?? 0) + 1);
  }

  function dominant(tally: Map<string, number>): string {
    let best = '';
    let bestN = -1;
    for (const [k, n] of tally) {
      if (n > bestN) {
        best = k;
        bestN = n;
      }
    }
    return best;
  }

  return [...acc.values()]
    .map((b) => ({
      key: b.key,
      channel: dominant(b.channelTally),
      source: dominant(b.sourceTally),
      tenants: b.tenants,
      withBilling: b.withBilling,
      active: b.active,
      firstAcquiredAt: b.firstAcquiredAt ? b.firstAcquiredAt.toISOString() : null,
      lastAcquiredAt: b.lastAcquiredAt ? b.lastAcquiredAt.toISOString() : null,
    }))
    .sort((x, y) => y.tenants - x.tenants);
}

/** ISO-8601 date/datetime string → Date, or null on empty, or a 400 throw on
 *  garbage. Accepts `2026-06-01` and full timestamps alike. */
function parseDateParam(raw: string | undefined, label: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw badRequest(`Invalid ${label} date: "${raw}". Use ISO-8601 (e.g. 2026-06-01).`);
  }
  return d;
}

function csvCell(value: string | number | null): string {
  if (value === null) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Tidy long-format CSV: one row per group across all three dimensions, so it
 *  pastes straight into a sheet and pivots cleanly. */
function toCsv(
  byChannel: GroupBucket[],
  bySource: GroupBucket[],
  byCampaign: GroupBucket[]
): string {
  const header = [
    'dimension',
    'channel',
    'source',
    'campaign',
    'tenants',
    'with_billing',
    'active',
  ];
  const lines = [header.join(',')];
  for (const b of byChannel) {
    lines.push(
      ['channel', b.key, '', '', b.tenants, b.withBilling, b.active].map(csvCell).join(',')
    );
  }
  for (const b of bySource) {
    lines.push(
      ['source', b.channel, b.key, '', b.tenants, b.withBilling, b.active].map(csvCell).join(',')
    );
  }
  for (const b of byCampaign) {
    lines.push(
      ['campaign', b.channel, b.source, b.key, b.tenants, b.withBilling, b.active]
        .map(csvCell)
        .join(',')
    );
  }
  return lines.join('\n') + '\n';
}

const acquisitionReportRoutes: FastifyPluginAsync = (app) => {
  app.get<{ Querystring: { since?: string; until?: string; format?: string } }>(
    '/internal/acquisition/summary',
    {
      logLevel: 'warn',
      // Internal contract — keep it out of the public OpenAPI spec.
      schema: { hide: true },
    },
    async (request, reply) => {
      authorize(request);

      const since = parseDateParam(request.query.since, 'since');
      const until = parseDateParam(request.query.until, 'until');

      // Window is on signup date (createdAt), not acquiredAt — acquiredAt is
      // null for tenants that predate attribution, and the operator is asking
      // "who signed up in this window and where from".
      const where: Prisma.TenantWhereInput = {};
      if (since || until) {
        where.createdAt = {};
        if (since) where.createdAt.gte = since;
        if (until) where.createdAt.lte = until;
      }

      const rows = (await prisma.tenant.findMany({
        where,
        select: {
          acquisitionChannel: true,
          acquisitionSource: true,
          acquisitionCampaign: true,
          acquiredAt: true,
          status: true,
          stripeCustomerId: true,
          createdAt: true,
        },
      })) as TenantRow[];

      const totals = {
        tenants: rows.length,
        attributed: rows.filter((r) => r.acquisitionChannel !== null).length,
        unattributed: rows.filter((r) => r.acquisitionChannel === null).length,
        withBilling: rows.filter((r) => r.stripeCustomerId !== null).length,
      };

      const byChannel = groupBy(
        rows,
        (r) => r.acquisitionChannel ?? UNATTRIBUTED,
        (r) => r.acquisitionChannel ?? UNATTRIBUTED,
        (r) => r.acquisitionSource ?? UNATTRIBUTED
      );
      const bySource = groupBy(
        rows.filter((r) => r.acquisitionSource !== null),
        (r) => r.acquisitionSource ?? UNATTRIBUTED,
        (r) => r.acquisitionChannel ?? UNATTRIBUTED,
        (r) => r.acquisitionSource ?? UNATTRIBUTED
      );
      const byCampaign = groupBy(
        rows.filter((r) => r.acquisitionCampaign !== null),
        (r) => r.acquisitionCampaign ?? UNATTRIBUTED,
        (r) => r.acquisitionChannel ?? UNATTRIBUTED,
        (r) => r.acquisitionSource ?? UNATTRIBUTED
      );

      if ((request.query.format ?? '').toLowerCase() === 'csv') {
        return reply
          .header('content-type', 'text/csv; charset=utf-8')
          .header('content-disposition', 'attachment; filename="acquisition-summary.csv"')
          .send(toCsv(byChannel, bySource, byCampaign));
      }

      return {
        success: true,
        data: {
          generatedAt: new Date().toISOString(),
          window: {
            since: since ? since.toISOString() : null,
            until: until ? until.toISOString() : null,
          },
          totals,
          byChannel,
          bySource,
          byCampaign,
        },
      };
    }
  );
  return Promise.resolve();
};

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}
function unauthorized(message: string): HttpError {
  return new HttpError(401, 'UNAUTHORIZED', message);
}
function badRequest(message: string): HttpError {
  return new HttpError(400, 'BAD_REQUEST', message);
}

export default acquisitionReportRoutes;
