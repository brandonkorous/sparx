// Mounts every /v1/invoicing/* route group (docs/87). One register call from
// app.ts so the invoicing URL space lives behind a single registration point.

import type { FastifyPluginAsync } from 'fastify';
import { documentLineTypeService, documentWorkflowService } from '@sparx/crm';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';

import workflowRoutes from './workflows.js';
import lineTypeRoutes from './line-types.js';
import documentRoutes from './documents.js';
import templateRoutes from './templates.js';
import agingRoutes from './aging.js';
import reportRoutes from './reports.js';
import { toInvoicingContext } from '../../../lib/invoicing-context.js';

const invoicingRoutes: FastifyPluginAsync = async (app) => {
  await app.register(workflowRoutes);
  await app.register(lineTypeRoutes);
  await app.register(documentRoutes);
  await app.register(templateRoutes);
  await app.register(agingRoutes);
  await app.register(reportRoutes);

  // Idempotent seed for tenants that just enabled invoicing. The same bootstrap
  // functions run on the `module.activated` consumer; both paths are no-ops on
  // re-run. The dashboard calls this inline so a freshly-activated tenant sees
  // the default workflows + line-type registry without waiting on the bus. No
  // invoicing-module gate — by definition this fires the moment activation
  // lands, before any other invoicing route is allowed.
  app.post('/v1/invoicing/bootstrap', async (request) => {
    requireRole(request, 'admin');
    const ctx = toInvoicingContext(request);
    await documentWorkflowService.bootstrapDefaultWorkflows(ctx);
    await documentLineTypeService.bootstrapDefaultLineTypes(ctx);
    return ok({ bootstrapped: true });
  });
};

export default invoicingRoutes;
