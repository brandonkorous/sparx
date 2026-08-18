// Invoicing — AR aging report (docs/87 §8).
//
//   GET /v1/invoicing/aging[?companyId=…]  → open balances bucketed by age
//
// The canonical AR aging view. It lives under /v1/invoicing because invoicing
// OWNS the billing-document surface; B2B and Commerce dashboards PULL this into
// their own space (optionally scoped to one account via ?companyId). Gated on
// the invoicing module — which B2B/Commerce tenants satisfy for free via the
// BUNDLED_FREE graph, so they reach it without a standalone purchase.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { billingDocumentService } from '@wizeworks/crm';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireInvoicingModule, toInvoicingContext } from '../../../lib/invoicing-context.js';

const AgingQuery = z.object({
  companyId: z.string().uuid().optional(),
  // `b2b` restricts the report to AR with a B2B account (the B2B Invoices view);
  // omit for the full cross-document aging.
  scope: z.enum(['b2b']).optional(),
});

const agingRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/invoicing/aging', async (request) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const { companyId, scope } = AgingQuery.parse(request.query);
    return ok(
      await billingDocumentService.aging(toInvoicingContext(request), {
        companyId,
        b2bOnly: scope === 'b2b',
      })
    );
  });

  return Promise.resolve();
};

export default agingRoutes;
