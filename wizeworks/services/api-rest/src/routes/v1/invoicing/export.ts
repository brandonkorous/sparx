// Invoices, quotes and every other billing document, as a spreadsheet.
//
//   GET /v1/export/invoices → one row per billing document
//
// "Kind" is the document's workflow ("Invoice", "Quote", or whatever the
// business named its own), because that is what a billing document IS here:
// there is no type column, the workflow it travels through decides it. "Stage"
// is where it stands in that workflow; "status" is the money state the service
// keeps (unpaid / partial / paid / void ...).
//
// `issued_at` is the date it was finalized and stays blank on a draft. The
// printed document falls back to the creation date for a draft's preview, but a
// spreadsheet column called "issued" must not claim a draft was issued; the
// creation date has its own column.
//
// Amounts are stored as decimals in MAJOR units (Decimal(12, 2)).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { billingDocumentService } from '@wizeworks/crm';
import { csvSafeText } from '@wizeworks/inventory';
import { requireRole } from '@wizeworks/api-core/auth';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { requireInvoicingModule, toInvoicingContext } from '../../../lib/invoicing-context.js';
import { reachableSiteIds } from '../../../lib/property.js';
import {
  EXPORT_ROW_CAP,
  collectPages,
  decimalAmount,
  sendCsvExport,
} from '../../../lib/record-export.js';

const ExportQuery = z.object({
  status: z.string().max(20).optional(),
  workflowId: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(EXPORT_ROW_CAP).optional(),
});

/** The list service's own page ceiling. */
const PAGE = 250;

// eslint-disable-next-line @typescript-eslint/require-await
const invoicingExportRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/export/invoices', async (request, reply) => {
    const auth = requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const q = ExportQuery.parse(request.query);
    const ctx = toInvoicingContext(request);

    const documents = await collectPages(PAGE, q.take ?? EXPORT_ROW_CAP, (offset, limit) =>
      billingDocumentService.list(ctx, {
        status: q.status,
        workflowId: q.workflowId,
        // Bound to the member's reachable sites (docs/131 §3.3), exactly as the
        // list is: invoices are among the most sensitive per-business records.
        propertyIds: reachableSiteIds(auth),
        limit,
        offset,
        sortBy: 'createdAt',
        order: 'desc',
      })
    );

    // Workflow and stage NAMES. The document carries only their ids, and an id
    // in a spreadsheet tells nobody whether a row is a quote or an invoice.
    const [workflows, stages] = await withRequestTenant(request, (tx) =>
      Promise.all([
        tx.documentWorkflow.findMany({ select: { id: true, name: true } }),
        tx.documentStage.findMany({ select: { id: true, name: true } }),
      ])
    );
    const workflowName = new Map(workflows.map((w) => [w.id, w.name]));
    const stageName = new Map(stages.map((s) => [s.id, s.name]));

    return sendCsvExport(reply, {
      name: 'invoices',
      headers: [
        'number',
        'kind',
        'stage',
        'status',
        'billed_to',
        'created_at',
        'issued_at',
        'due_at',
        'sent_at',
        'paid_at',
        'currency',
        'subtotal',
        'discount',
        'tax',
        'shipping',
        'surcharge',
        'total',
        'amount_paid',
        'balance',
      ],
      rows: documents.map((d) => [
        d.number,
        workflowName.get(d.workflowId) ?? null,
        stageName.get(d.stageId) ?? null,
        d.status,
        csvSafeText(d.billedToName),
        d.createdAt,
        d.finalizedAt,
        d.dueAt,
        d.sentAt,
        d.paidAt,
        d.currency,
        decimalAmount(d.subtotal),
        decimalAmount(d.discountTotal),
        decimalAmount(d.taxTotal),
        decimalAmount(d.shippingTotal),
        decimalAmount(d.surchargeTotal),
        decimalAmount(d.total),
        decimalAmount(d.amountPaid),
        decimalAmount(d.balance),
      ]),
    });
  });
};

export default invoicingExportRoutes;
