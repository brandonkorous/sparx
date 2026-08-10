// B2B accounts import/export routes (docs/68 §8).
//
//   POST /v1/b2b/accounts/import        → submit rows, create job
//   GET  /v1/b2b/accounts/import/:jobId → poll job status + row results
//   GET  /v1/export/b2b-accounts        → synchronous CSV download

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withRequestTenant } from '@sparx/api-core/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { publish } from '@sparx/api-core/pubsub';
import { notFound } from '@sparx/api-core/errors';
import { requireB2bModule } from '../../../lib/b2b-context.js';
import { companyService } from '@sparx/crm';
import { requireCrmModule, toCrmContext } from '../../../lib/crm-context.js';

const PathJobId = z.object({ jobId: z.string().uuid() });

const SubmitImportBody = z.object({
  rows: z.array(z.record(z.string(), z.string())).min(1).max(10_000),
  options: z.object({ upsert: z.boolean().optional() }).optional(),
  fileName: z.string().max(255).optional(),
});

const ExportQuery = z.object({
  status: z.enum(['active', 'credit_hold', 'suspended', 'inactive']).optional(),
  q: z.string().max(255).optional(),
  take: z.coerce.number().int().min(1).max(10_000).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await
const b2bImportExportRoutes: FastifyPluginAsync = async (app) => {
  // ──────────────────────────────────────────────────────────────────────
  // POST /v1/b2b/accounts/import
  // ──────────────────────────────────────────────────────────────────────
  app.post('/v1/b2b/accounts/import', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    await requireB2bModule(request);

    const input = SubmitImportBody.parse(request.body);

    const job = await withRequestTenant(request, async (tx) =>
      tx.importJob.create({
        data: {
          tenantId: auth.tenantId,
          entityType: 'b2b_accounts',
          status: 'pending',
          fileName: input.fileName ?? null,
          rowCount: input.rows.length,
          options: input.options ?? {},
          rawRows: input.rows,
          actorId: auth.actorId ?? null,
        },
        select: { id: true },
      })
    );

    await publish(request.log, 'import.job.created', auth.tenantId, auth.actorId, {
      jobId: job.id,
      entityType: 'b2b_accounts',
    });

    reply.statusCode = 202;
    return ok({ jobId: job.id });
  });

  // ──────────────────────────────────────────────────────────────────────
  // GET /v1/b2b/accounts/import/:jobId
  // ──────────────────────────────────────────────────────────────────────
  app.get('/v1/b2b/accounts/import/:jobId', async (request) => {
    requireRole(request, 'viewer');
    await requireB2bModule(request);

    const { jobId } = PathJobId.parse(request.params);

    const job = await withRequestTenant(request, async (tx) =>
      tx.importJob.findFirst({
        where: { id: jobId },
        include: { rows: { orderBy: { rowIndex: 'asc' }, take: 500 } },
      })
    );
    if (!job) throw notFound('ImportJob', jobId);

    return ok({
      id: job.id,
      entityType: job.entityType,
      status: job.status,
      fileName: job.fileName,
      rowCount: job.rowCount,
      importedCount: job.importedCount,
      updatedCount: job.updatedCount,
      errorCount: job.errorCount,
      completedAt: job.completedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      rows: job.rows.map((r) => ({
        rowIndex: r.rowIndex,
        status: r.status,
        naturalKey: r.naturalKey,
        errorMsg: r.errorMsg,
      })),
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // GET /v1/export/b2b-accounts
  // ──────────────────────────────────────────────────────────────────────
  app.get('/v1/export/b2b-accounts', async (request, reply) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);

    const q = ExportQuery.parse(request.query);
    const ctx = toCrmContext(request);

    const { items } = await companyService.list(ctx, {
      status: q.status,
      q: q.q,
      take: q.take ?? 5_000,
    });

    const rows = items.map((a) => ({
      id: a.id,
      company_name: a.companyName,
      tax_id: a.taxId ?? '',
      website: a.website ?? '',
      pricing_tier: a.pricingTier ?? '',
      credit_limit: Number(a.creditLimit).toFixed(2),
      payment_terms: a.paymentTerms ?? '',
      discount_percent: Number(a.discountPercent).toFixed(2),
      status: a.status,
      notes: a.notes ?? '',
      tags: a.tags.join(','),
      updated_at: a.updatedAt.toISOString(),
    }));

    const csv = toCsv(rows);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="b2b-accounts-export.csv"');
    return reply.send(csv);
  });
};

export default b2bImportExportRoutes;

type CsvPrimitive = string | number | boolean | null | undefined;

function toCsv(rows: Record<string, CsvPrimitive>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const escape = (v: CsvPrimitive) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join(
    '\r\n'
  );
}
