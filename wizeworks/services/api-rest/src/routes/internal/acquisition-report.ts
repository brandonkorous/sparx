// Internal L-PLAT acquisition report (docs/80 §10). Serves the channel / source
// / campaign breakdown of `tenants.acquisition_*` — written once at signup from
// the first-party attribution cookies — as JSON or as a spreadsheet-ready CSV.
//
// Auth: shared secret in `X-sparx-Internal-Acquisition-Token`, constant-time
// compared against env.SPARX_INTERNAL_ACQUISITION_TOKEN. This is a SEPARATE
// secret from the cron token (SPARX_INTERNAL_CRON_TOKEN) on purpose — it exposes
// cross-tenant business intelligence, a different blast radius than triggering a
// scheduler, so it rotates independently and can be handed out without also
// granting cron-trigger access.
//
// ── WHY THIS STILL EXISTS NOW THAT THE OPERATOR CONSOLE DOES ────────────────
//
// This file used to explain itself with "sparx has no staff/operator auth tier
// … a real operator console lands when the platform-admin tier in docs/16 §2.4
// is built." That console IS built — wizeworks/apps/admin — and it reads the same
// breakdown through `/internal/operator/acquisition`, behind a real capability
// check rather than a shared secret. So the console is now the answer to "show
// me the numbers", and the reason to keep this endpoint is narrower and honest:
// a token a person can hand to a script, and a CSV that pastes into a sheet and
// pivots. Neither of those wants a browser session.
//
// Both doors call the SAME aggregation (acquisition-summary.ts). That is the
// whole point of the split — two implementations is how the console and the
// spreadsheet start disagreeing about the same week with nothing to say which
// one is right.
//
//   • GET /internal/acquisition/summary                 → JSON breakdown
//   • GET /internal/acquisition/summary?format=csv      → tidy long-format CSV
//   • GET /internal/acquisition/summary?since=…&until=… → window on signup date
//
// The `tenants` table is intentionally non-RLS (the dispatch row), so this reads
// across every tenant with the plain system Prisma client — no tenant context to
// establish.

import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { prisma, type Prisma } from '@wizeworks/db';
import type { OperatorAcquisitionBucket } from '@wizeworks/operator';

import { env } from '../../env.js';
import {
  ACQUISITION_SELECT,
  summarizeAcquisition,
  type AcquisitionRow,
} from './acquisition-summary.js';

const ACQ_TOKEN_HEADER = 'x-sparx-internal-acquisition-token';

function authorize(request: FastifyRequest): void {
  const expected = env.SPARX_INTERNAL_ACQUISITION_TOKEN;
  if (!expected) {
    // No token configured → endpoint is disabled. 401 so a forgotten secret in
    // prod surfaces loudly instead of silently leaking the report.
    throw unauthorized('Internal acquisition token is not configured.');
  }
  const provided = request.headers[ACQ_TOKEN_HEADER];
  if (typeof provided !== 'string' || provided.length === 0) {
    throw unauthorized('Missing X-sparx-Internal-Acquisition-Token header.');
  }
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw unauthorized('Invalid acquisition token.');
  }
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
  byChannel: OperatorAcquisitionBucket[],
  bySource: OperatorAcquisitionBucket[],
  byCampaign: OperatorAcquisitionBucket[]
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
        select: ACQUISITION_SELECT,
      })) as AcquisitionRow[];

      const summary = summarizeAcquisition(rows, { since, until }, new Date());

      if ((request.query.format ?? '').toLowerCase() === 'csv') {
        return reply
          .header('content-type', 'text/csv; charset=utf-8')
          .header('content-disposition', 'attachment; filename="acquisition-summary.csv"')
          .send(toCsv(summary.byChannel, summary.bySource, summary.byCampaign));
      }

      return { success: true, data: summary };
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
