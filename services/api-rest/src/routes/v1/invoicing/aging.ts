// Invoicing — AR aging report (docs/87 §8).
//
//   GET /v1/invoicing/aging[?b2bAccountId=…]  → open balances bucketed by age
//
// The canonical AR aging view. It lives under /v1/invoicing because invoicing
// OWNS the billing-document surface; B2B and Commerce dashboards PULL this into
// their own space (optionally scoped to one account via ?b2bAccountId). Gated on
// the invoicing module — which B2B/Commerce tenants satisfy for free via the
// BUNDLED_FREE graph, so they reach it without a standalone purchase.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { billingDocumentService } from '@sparx/crm';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireInvoicingModule, toInvoicingContext } from '../../../lib/invoicing-context.js';

const AgingQuery = z.object({ b2bAccountId: z.string().uuid().optional() });

const agingRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/invoicing/aging', async (request) => {
    requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const { b2bAccountId } = AgingQuery.parse(request.query);
    return ok(await billingDocumentService.aging(toInvoicingContext(request), { b2bAccountId }));
  });

  return Promise.resolve();
};

export default agingRoutes;
