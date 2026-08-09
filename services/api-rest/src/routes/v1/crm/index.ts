// Mounts every /v1/crm/* route group. One register call from app.ts so the
// CRM URL space lives behind a single registration point.
//
// Orders are NOT here. They live at the top-level /v1/orders root
// (routes/v1/orders.ts) because an order is a shared spine produced by Commerce
// or B2B checkout and merely READ by CRM — three separately billed modules, so
// no one of them owns the namespace. See lib/order-context.ts.

import type { FastifyPluginAsync } from 'fastify';
import { associationService, objectDefService, pipelineService, segmentService } from '@sparx/crm';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';

import customerRoutes from './customers.js';
import b2bAccountRoutes from './b2b-accounts.js';
import objectDefRoutes from './object-defs.js';
import associationRoutes from './associations.js';
import engagementRoutes from './engagement.js';
import callRoutes from './calls.js';
import ticketRoutes from './tickets.js';
import pipelineRoutes from './pipelines.js';
import dealRoutes from './deals.js';
import activityRoutes from './activities.js';
import taskRoutes from './tasks.js';
import segmentRoutes from './segments.js';
import reportRoutes from './reports.js';
import reportBuilderRoutes from './report-builder.js';
import crmImportExportRoutes from './import.js';
import { toCrmContext } from '../../../lib/crm-context.js';

const crmRoutes: FastifyPluginAsync = async (app) => {
  // The object registry first — it is what says what every other record IS.
  await app.register(objectDefRoutes);
  // Associations name their endpoints with object keys, so they follow the
  // registry (docs/144 §14 — phases 1 and 2 are strictly ordered).
  await app.register(associationRoutes);
  await app.register(engagementRoutes);
  await app.register(callRoutes);
  // Service requests (docs/144 §7) — registered before customers so the queue's
  // routes are mounted alongside the rest of the engagement surface they belong
  // with, rather than at the end of an unrelated list.
  await app.register(ticketRoutes);
  await app.register(customerRoutes);
  await app.register(b2bAccountRoutes);
  await app.register(pipelineRoutes);
  await app.register(dealRoutes);
  await app.register(activityRoutes);
  await app.register(taskRoutes);
  await app.register(segmentRoutes);
  await app.register(reportRoutes);
  await app.register(reportBuilderRoutes);
  await app.register(crmImportExportRoutes);

  // Idempotent seed for tenants that just enabled CRM. Same functions also
  // run on the `module.activated` Pub/Sub consumer; both paths are no-ops on
  // re-run. The dashboard calls this inline so freshly-activated tenants see
  // the default pipeline + built-in segments without waiting on the bus.
  // No CRM-module gate — by definition this fires the moment activation
  // lands and before any other CRM route is allowed.
  app.post('/v1/crm/bootstrap', async (request) => {
    requireRole(request, 'admin');
    const ctx = toCrmContext(request);
    // The object registry first: every contact/deal/company write reads its
    // object's schema, so the four built-in rows have to exist before the
    // pipeline and segment seeds below create anything.
    await objectDefService.ensureBuiltins(ctx);
    await associationService.ensureBuiltinLabels(ctx);
    await pipelineService.bootstrapDefaultPipeline(ctx);
    await segmentService.bootstrapBuiltInSegments(ctx);
    return ok({ bootstrapped: true });
  });
};

export default crmRoutes;
