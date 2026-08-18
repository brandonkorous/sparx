// Commerce import/export routes (docs/68 §8).
//
//   POST /v1/commerce/products/import        → submit CSV rows, create job
//   GET  /v1/commerce/products/import/:jobId → poll job status + row results
//   GET  /v1/export/products                 → synchronous CSV download

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { publish } from '@wizeworks/api-core/pubsub';
import { notFound } from '@wizeworks/api-core/errors';
import { requireCommerceModule, toCommerceContext } from '../../../lib/commerce-context.js';
import { productService, discountService } from '@wizeworks/commerce';

const PathJobId = z.object({ jobId: z.string().uuid() });

const SubmitImportBody = z.object({
  rows: z.array(z.record(z.string(), z.string())).min(1).max(10_000),
  options: z
    .object({
      upsert: z.boolean().optional(),
      columnMap: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  fileName: z.string().max(255).optional(),
});

const ListExportQuery = z.object({
  status: z.string().optional(),
  vendor: z.string().optional(),
  product_type: z.string().optional(),
  tag: z.string().optional(),
  take: z.coerce.number().int().min(1).max(10_000).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await
const importExportRoutes: FastifyPluginAsync = async (app) => {
  // ──────────────────────────────────────────────────────────────────────
  // POST /v1/commerce/products/import
  // ──────────────────────────────────────────────────────────────────────
  app.post('/v1/commerce/products/import', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    await requireCommerceModule(request);

    const input = SubmitImportBody.parse(request.body);

    const job = await withRequestTenant(request, async (tx) =>
      tx.importJob.create({
        data: {
          tenantId: auth.tenantId,
          entityType: 'products',
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
      entityType: 'products',
    });

    reply.statusCode = 202;
    return ok({ jobId: job.id });
  });

  // ──────────────────────────────────────────────────────────────────────
  // GET /v1/commerce/products/import/:jobId
  // ──────────────────────────────────────────────────────────────────────
  app.get('/v1/commerce/products/import/:jobId', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);

    const { jobId } = PathJobId.parse(request.params);

    const job = await withRequestTenant(request, async (tx) =>
      tx.importJob.findFirst({
        where: { id: jobId },
        include: {
          rows: {
            orderBy: { rowIndex: 'asc' },
            take: 500,
          },
        },
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
  // GET /v1/export/products
  // ──────────────────────────────────────────────────────────────────────
  app.get('/v1/export/products', async (request, reply) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);

    const q = ListExportQuery.parse(request.query);
    const ctx = toCommerceContext(request);

    const { items } = await productService.list(ctx, {
      status: q.status as never,
      vendor: q.vendor,
      productType: q.product_type,
      tag: q.tag,
      take: q.take ?? 5_000,
    });

    const rows = items.map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      status: p.status,
      vendor: p.vendor ?? '',
      product_type: p.productType ?? '',
      tags: p.tags.join(','),
      updated_at: p.updatedAt,
    }));

    const csv = toCsv(rows);

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="products-export.csv"');
    return reply.send(csv);
  });

  // ──────────────────────────────────────────────────────────────────────
  // POST /v1/commerce/discounts/import
  // ──────────────────────────────────────────────────────────────────────
  app.post('/v1/commerce/discounts/import', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    await requireCommerceModule(request);

    const input = SubmitImportBody.parse(request.body);

    const job = await withRequestTenant(request, async (tx) =>
      tx.importJob.create({
        data: {
          tenantId: auth.tenantId,
          entityType: 'discounts',
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
      entityType: 'discounts',
    });

    reply.statusCode = 202;
    return ok({ jobId: job.id });
  });

  // ──────────────────────────────────────────────────────────────────────
  // GET /v1/commerce/discounts/import/:jobId
  // ──────────────────────────────────────────────────────────────────────
  app.get('/v1/commerce/discounts/import/:jobId', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);

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
  // GET /v1/export/discounts
  // ──────────────────────────────────────────────────────────────────────
  app.get('/v1/export/discounts', async (request, reply) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);

    const ctx = toCommerceContext(request);
    const { items: discounts } = await discountService.listDiscounts(ctx, { take: 250 });

    const rows = discounts.map((d) => ({
      code: d.code ?? '',
      name: d.name,
      description: d.description ?? '',
      type: d.type,
      scope: d.scope,
      value_cents: d.valueCents != null ? String(d.valueCents) : '',
      value_percent: d.valuePercent != null ? String(d.valuePercent) : '',
      currency: d.currency ?? '',
      status: d.status,
      start_at: d.startAt ?? '',
      end_at: d.endAt ?? '',
      total_usage_limit: d.totalUsageLimit != null ? String(d.totalUsageLimit) : '',
      per_customer_limit: String(d.perCustomerLimit),
      usage_count: String(d.usageCount),
      updated_at: d.updatedAt,
    }));

    const csv = toCsv(rows);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="discounts-export.csv"');
    return reply.send(csv);
  });
};

export default importExportRoutes;

// ─── CSV serializer ───────────────────────────────────────────────────────────

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
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))];
  return lines.join('\r\n');
}
