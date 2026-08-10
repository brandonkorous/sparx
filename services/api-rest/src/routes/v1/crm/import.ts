// CRM import/export routes (docs/68 §8).
//
//   POST /v1/crm/customers/import        → submit CSV rows, create job
//   GET  /v1/crm/customers/import/:jobId → poll job status + row results
//   GET  /v1/export/customers            → synchronous CSV download

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { CustomerType } from '@sparx/crm-schemas';
import { withRequestTenant } from '@sparx/api-core/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { publish } from '@sparx/api-core/pubsub';
import { notFound } from '@sparx/api-core/errors';
import { asBag, customerService, objectDefService } from '@sparx/crm';
import { isModuleEnabled } from '@sparx/auth';
import { requireAuth } from '@sparx/api-core/auth';
import { moduleDisabled } from '@sparx/api-core/errors';

const PathJobId = z.object({ jobId: z.string().uuid() });

const SubmitImportBody = z.object({
  rows: z.array(z.record(z.string(), z.string())).min(1).max(10_000),
  options: z
    .object({
      upsert: z.boolean().optional(),
    })
    .optional(),
  fileName: z.string().max(255).optional(),
});

const ListExportQuery = z.object({
  type: CustomerType.optional(),
  q: z.string().optional(),
  take: z.coerce.number().int().min(1).max(10_000).optional(),
});

async function requireCrmModule(request: Parameters<typeof requireAuth>[0]): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'crm');
  if (!enabled) throw moduleDisabled('crm');
}

function toCrmContext(request: Parameters<typeof requireAuth>[0]) {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

// eslint-disable-next-line @typescript-eslint/require-await
const crmImportExportRoutes: FastifyPluginAsync = async (app) => {
  // ──────────────────────────────────────────────────────────────────────
  // POST /v1/crm/customers/import
  // ──────────────────────────────────────────────────────────────────────
  app.post('/v1/crm/customers/import', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    await requireCrmModule(request);

    const input = SubmitImportBody.parse(request.body);

    const job = await withRequestTenant(request, async (tx) =>
      tx.importJob.create({
        data: {
          tenantId: auth.tenantId,
          entityType: 'customers',
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
      entityType: 'customers',
    });

    reply.statusCode = 202;
    return ok({ jobId: job.id });
  });

  // ──────────────────────────────────────────────────────────────────────
  // GET /v1/crm/customers/import/:jobId
  // ──────────────────────────────────────────────────────────────────────
  app.get('/v1/crm/customers/import/:jobId', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);

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
  // GET /v1/export/customers
  // ──────────────────────────────────────────────────────────────────────
  app.get('/v1/export/customers', async (request, reply) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);

    const q = ListExportQuery.parse(request.query);
    const ctx = toCrmContext(request);

    const { items } = await customerService.list(ctx, {
      type: q.type,
      q: q.q,
      take: q.take ?? 5_000,
    });

    // The tenant's own declared properties export too, one column each, headed
    // by the label they wrote. An export that drops them is an export that
    // cannot be re-imported without losing them — and "download, edit in a
    // spreadsheet, upload" is the whole point of this endpoint. The header is
    // `custom.<key>` so a property whose label collides with a built-in column
    // still round-trips; the importer reads that prefix explicitly.
    const schema = await objectDefService.schemaFor(ctx, 'contact');
    const exportable = schema.fields.filter((field) => field.type !== 'calculated');

    const rows = items.map((c) => {
      const bag = asBag((c as { customProperties?: unknown }).customProperties);
      return {
        id: c.id,
        type: c.type,
        email: c.email ?? '',
        first_name: c.firstName ?? '',
        last_name: c.lastName ?? '',
        company: c.companyName ?? '',
        phone: c.phone ?? '',
        job_title: c.jobTitle ?? '',
        tags: c.tags.join(','),
        do_not_contact: String(c.doNotContact),
        created_at: c.createdAt.toISOString(),
        updated_at: c.updatedAt.toISOString(),
        ...Object.fromEntries(
          exportable.map((field) => [`custom.${field.key}`, cellFor(bag[field.key])])
        ),
      };
    });

    const csv = toCsv(rows);

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="customers-export.csv"');
    return reply.send(csv);
  });
};

export default crmImportExportRoutes;

type CsvPrimitive = string | number | boolean | null | undefined;

/**
 * One stored property value as a spreadsheet cell.
 *
 * Money exports as the bare amount followed by its code ("4800 USD") because
 * that is what the importer's coercion reads back; a list joins with commas;
 * anything nested falls back to JSON, which is also what the importer expects
 * for that shape. Round-trip fidelity is the requirement, not prettiness.
 */
function cellFor(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => cellFor(item)).join(',');
  if (typeof value === 'object') {
    const money = value as { amount?: unknown; currency?: unknown };
    if (typeof money.amount === 'number' && typeof money.currency === 'string') {
      return `${String(money.amount)} ${money.currency}`;
    }
    return JSON.stringify(value);
  }
  // Everything an object could be is handled above; what is left is a symbol or
  // a function, neither of which belongs in a property bag. JSON is still the
  // honest answer rather than "[object Object]".
  return JSON.stringify(value) ?? '';
}

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
