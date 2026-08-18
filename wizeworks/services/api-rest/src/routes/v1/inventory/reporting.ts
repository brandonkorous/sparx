// Reporting, portability and the accounting handoff (docs/146 Phase 10).
//
// One addressable report endpoint, the schedules that email them, the file
// import, and the reconciliation against the tenant's books.
//
//   The report surface (10.1 + 10.3)
//     GET  /v1/inventory/reports/catalog            — what reports exist
//     GET  /v1/inventory/reports/:key?format=csv    — run ANY of them
//
//   Scheduled delivery (10.4)
//     GET    /v1/inventory/report-schedules
//     GET    /v1/inventory/report-schedules/:id
//     POST   /v1/inventory/report-schedules
//     PATCH  /v1/inventory/report-schedules/:id
//     DELETE /v1/inventory/report-schedules/:id
//     POST   /v1/inventory/report-schedules/:id/run   — send it now
//
//   Adjustment import (10.5 + 10.6)
//     GET  /v1/inventory/imports/template?format=csv
//     GET  /v1/inventory/imports
//     POST /v1/inventory/imports                      — plan; writes no stock
//     GET  /v1/inventory/imports/:id
//     POST /v1/inventory/imports/:id/apply
//     POST /v1/inventory/imports/:id/discard
//     POST /v1/inventory/imports/:id/reverse
//
//   Stock versus the books (10.9)
//     GET  /v1/inventory/gl-reconciliation
//     GET  /v1/inventory/gl-snapshots
//     POST /v1/inventory/gl-snapshots
//
// ── Why ONE report endpoint and not eighteen ─────────────────────────────────
//
// 10.3 asks that every report be addressable by API with the SAME filters the
// screen uses. A route per report satisfies that on the day it is written and
// stops satisfying it the first time somebody adds a report and forgets the
// route. `/reports/:key` resolves through the registry in @wizeworks/inventory, so
// the API's coverage IS the registry's coverage, permanently. The named routes
// in analytics-reports.ts stay: they are the documented contract for the four
// reports that shipped before the registry existed, and breaking a published URL
// to tidy a file is not a trade worth making.
//
// ── Role split ───────────────────────────────────────────────────────────────
//
// Reads are `viewer`. Schedules are `editor` — deciding who gets a weekly email
// is ordinary work. The import PLAN is `editor` (it writes no stock) and both
// APPLY and REVERSE are `admin`: posting four hundred movements from a
// spreadsheet, or undoing them, is the largest single write in the module.
// Recording what the accountant says the inventory account holds is `admin` too,
// because every reconciliation afterwards is measured against it.

import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { inventoryService, toCsv, type CsvTable } from '@wizeworks/inventory';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireInventoryModule, toInventoryContext } from '../../../lib/inventory-context.js';

const IdPath = z.object({ id: z.string().uuid() });

/** Every report's filters, in the query-string spelling. Snake_case in, camel
 *  out — the same convention every other inventory route follows. */
const ReportQuery = z.object({
  format: z.enum(['json', 'csv']).optional(),
  warehouse_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().optional(),
  days: z.coerce.number().int().min(1).max(1095).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  take: z.coerce.number().int().min(1).max(5000).optional(),
});

const KeyPath = z.object({ key: z.string().min(1).max(40) });

const ScheduleQuery = z.object({
  take: z.coerce.number().int().min(1).max(200).optional(),
});

const ImportQuery = z.object({
  status: z.enum(['planned', 'applied', 'discarded', 'failed']).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const TemplateQuery = z.object({
  warehouse_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(20_000).optional(),
});

const PlanImportBody = z.object({
  csv: z.string().min(1).max(20_000_000),
  filename: z.string().max(255).optional(),
  warehouse_id: z.string().uuid().optional(),
  reason: z.string().max(20).optional(),
  // ── Phase 11.2: reading somebody else's headings ──
  // Field key → the heading in THIS file, confirmed on the mapping screen or
  // recalled from a saved profile. Absent fields fall back to the alias list.
  mapping: z.record(z.string().min(1).max(80), z.string().min(1).max(200)).optional(),
  profile_id: z.string().uuid().optional(),
  decimal: z.enum(['.', ',']).optional(),
  create_missing_items: z.boolean().optional(),
});

const GlQuery = z.object({
  as_of: z.string().datetime().optional(),
});

const GlSnapshotBody = z.object({
  as_of: z.string().datetime(),
  account_name: z.string().trim().min(1).max(200),
  account_code: z.string().trim().max(60).nullable().optional(),
  balance_cents: z.number().int(),
  currency: z.string().length(3).optional(),
  source: z.enum(['manual', 'quickbooks_online', 'xero']).optional(),
  connection_id: z.string().uuid().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});

function toFilters(q: z.infer<typeof ReportQuery>): Record<string, unknown> {
  return {
    ...(q.warehouse_id ? { warehouseId: q.warehouse_id } : {}),
    ...(q.supplier_id ? { supplierId: q.supplier_id } : {}),
    ...(q.days !== undefined ? { days: q.days } : {}),
    ...(q.from ? { from: q.from } : {}),
    ...(q.to ? { to: q.to } : {}),
    ...(q.take !== undefined ? { take: q.take } : {}),
  };
}

/** `dead-stock` and `dead_stock` are the same report. The registry spells keys
 *  with underscores and URLs are conventionally hyphenated; refusing one of them
 *  would be a footnote in the docs that everybody hits once. */
function normalizeKey(key: string): string {
  return key.replace(/-/g, '_');
}

function sendCsv(reply: FastifyReply, table: CsvTable): FastifyReply {
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="inventory-${table.name}.csv"`)
    .send(toCsv(table));
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const inventoryReportingRoutes: FastifyPluginAsync = async (app) => {
  // An import arrives as a raw CSV upload as well as JSON, matching the bulk
  // adjustment endpoint's contract.
  app.addContentTypeParser('text/csv', { parseAs: 'string' }, (_req, body, done) => {
    done(null, { __csv: body });
  });

  // ── The report surface ───────────────────────────────────────────────────

  app.get('/v1/inventory/reports/catalog', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    return ok({ reports: inventoryService.reportCatalog() });
  });

  app.get('/v1/inventory/reports/:key', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { key } = KeyPath.parse(request.params);
    const q = ReportQuery.parse(request.query);
    const normalized = normalizeKey(key);

    if (!inventoryService.reportDefinition(normalized)) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: `There is no report called ${key}` },
      });
    }

    const run = await inventoryService.runReport(
      toInventoryContext(request),
      normalized,
      toFilters(q)
    );
    if (q.format === 'csv') return sendCsv(reply, run.csv);
    // The headline lines travel WITH the data. A screen that has to re-derive
    // "what this report could not measure" from the payload is a screen that
    // will eventually derive it differently from the email.
    return ok({
      key: run.key,
      label: run.label,
      generatedAt: run.generatedAt,
      summary: run.summary,
      rowCount: run.csv.rows.length,
      data: run.data,
    });
  });

  // ── Scheduled delivery ───────────────────────────────────────────────────

  app.get('/v1/inventory/report-schedules', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ScheduleQuery.parse(request.query);
    const { items, total } = await inventoryService.listReportSchedules(
      toInventoryContext(request)
    );
    return paged(items, { total, skip: 0, per_page: q.take ?? items.length });
  });

  app.get('/v1/inventory/report-schedules/:id', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = IdPath.parse(request.params);
    return ok(await inventoryService.getReportSchedule(toInventoryContext(request), id));
  });

  app.post('/v1/inventory/report-schedules', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const created = await inventoryService.createReportSchedule(
      toInventoryContext(request),
      request.body
    );
    return reply.status(201).send(ok(created));
  });

  app.patch('/v1/inventory/report-schedules/:id', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    return ok(
      await inventoryService.updateReportSchedule(toInventoryContext(request), id, request.body)
    );
  });

  app.delete('/v1/inventory/report-schedules/:id', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    await inventoryService.deleteReportSchedule(toInventoryContext(request), id);
    return reply.status(204).send();
  });

  // Send it now. The identical path a scheduled run takes — a test send that
  // took a different route would test nothing.
  app.post('/v1/inventory/report-schedules/:id/run', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    return ok(await inventoryService.runReportSchedule(toInventoryContext(request), id, 'manual'));
  });

  // ── Adjustment import ────────────────────────────────────────────────────

  // Current stock, in the columns the importer reads. Registered before the
  // `:id` route for readability; Fastify would match the static segment first
  // regardless.
  app.get('/v1/inventory/imports/template', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = TemplateQuery.parse(request.query);
    const table = await inventoryService.adjustmentTemplate(toInventoryContext(request), {
      warehouseId: q.warehouse_id ?? null,
      ...(q.take !== undefined ? { take: q.take } : {}),
    });
    return sendCsv(reply, table);
  });

  app.get('/v1/inventory/imports', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ImportQuery.parse(request.query);
    const take = q.take ?? 50;
    const skip = q.skip ?? 0;
    const { items, total } = await inventoryService.listImportBatches(toInventoryContext(request), {
      ...(q.status ? { status: q.status } : {}),
      take,
      skip,
    });
    return paged(items, { total, skip, per_page: take });
  });

  app.post('/v1/inventory/imports', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const body = normalizeImportBody(request.query, request.body);
    const input = PlanImportBody.parse(body);
    const plan = await inventoryService.planAdjustmentImport(toInventoryContext(request), {
      csv: input.csv,
      filename: input.filename ?? null,
      warehouseId: input.warehouse_id ?? null,
      ...(input.reason ? { reason: input.reason } : {}),
      mapping: input.mapping ?? null,
      profileId: input.profile_id ?? null,
      ...(input.decimal ? { decimal: input.decimal } : {}),
      ...(input.create_missing_items !== undefined
        ? { createMissingItems: input.create_missing_items }
        : {}),
    });
    return reply.status(201).send(ok(plan));
  });

  app.get('/v1/inventory/imports/:id', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const { id } = IdPath.parse(request.params);
    return ok(await inventoryService.getImportBatch(toInventoryContext(request), id));
  });

  app.post('/v1/inventory/imports/:id/apply', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = IdPath.parse(request.params);
    return ok(await inventoryService.applyImportBatch(toInventoryContext(request), id));
  });

  app.post('/v1/inventory/imports/:id/discard', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'editor');
    const { id } = IdPath.parse(request.params);
    return ok(await inventoryService.discardImportBatch(toInventoryContext(request), id));
  });

  app.post('/v1/inventory/imports/:id/reverse', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const { id } = IdPath.parse(request.params);
    return ok(await inventoryService.reverseImportBatch(toInventoryContext(request), id));
  });

  // ── Stock versus the books ───────────────────────────────────────────────

  app.get('/v1/inventory/gl-reconciliation', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = GlQuery.parse(request.query);
    return ok(
      await inventoryService.glReconciliationReport(toInventoryContext(request), {
        asOf: q.as_of ? new Date(q.as_of) : new Date(),
      })
    );
  });

  app.get('/v1/inventory/gl-snapshots', async (request) => {
    await requireInventoryModule(request);
    requireRole(request, 'viewer');
    const q = ScheduleQuery.parse(request.query);
    const items = await inventoryService.listGlSnapshots(toInventoryContext(request), {
      ...(q.take !== undefined ? { take: q.take } : {}),
    });
    return paged(items, { total: items.length, skip: 0, per_page: q.take ?? items.length });
  });

  app.post('/v1/inventory/gl-snapshots', async (request, reply) => {
    await requireInventoryModule(request);
    requireRole(request, 'admin');
    const input = GlSnapshotBody.parse(request.body);
    const row = await inventoryService.recordGlSnapshot(toInventoryContext(request), {
      asOf: new Date(input.as_of),
      accountName: input.account_name,
      accountCode: input.account_code ?? null,
      balanceCents: input.balance_cents,
      ...(input.currency ? { currency: input.currency } : {}),
      ...(input.source ? { source: input.source } : {}),
      connectionId: input.connection_id ?? null,
      note: input.note ?? null,
    });
    return reply.status(201).send(ok(row));
  });
};

/** A plan request may arrive as JSON or as a raw `text/csv` upload, in which
 *  case the filename and target location ride in the query string. */
function normalizeImportBody(rawQuery: unknown, body: unknown): unknown {
  if (body && typeof body === 'object' && '__csv' in body) {
    const query = (rawQuery ?? {}) as Record<string, string | undefined>;
    return {
      csv: (body as { __csv: string }).__csv,
      ...(query.filename ? { filename: query.filename } : {}),
      ...(query.warehouse_id ? { warehouse_id: query.warehouse_id } : {}),
      ...(query.reason ? { reason: query.reason } : {}),
    };
  }
  return body;
}

export default inventoryReportingRoutes;
