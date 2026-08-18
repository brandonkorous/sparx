// The dashboard catalogue (docs/129 §9).
//
//   GET /v1/analytics/dashboards      → the built-ins available to this tenant
//   GET /v1/analytics/dashboards/:id  → one dashboard's full config (its tiles)
//
// `analytics.dashboards.list` exists from day one so it can become the manager
// unchanged when user dashboards arrive; `:id` is a built-in slug today and a
// UUID slot later. Both are addressable entities, which is why the workbench pane
// needs no change to hold a user dashboard eventually.

import type { FastifyPluginAsync } from 'fastify';
import { listEnabledModules } from '@wizeworks/auth';
import { ok } from '@wizeworks/api-core/envelope';
import { requireAuth, requireRole } from '@wizeworks/api-core/auth';
import { notFound } from '@wizeworks/api-core/errors';

import {
  getDashboard,
  isDashboardAvailable,
  listDashboards,
  type DashboardConfig,
} from '../../../lib/analytics/dashboards.js';

/** The summary a list row needs — the tiles are fetched only when one is opened. */
function toSummary(dashboard: DashboardConfig) {
  return {
    id: dashboard.id,
    module: dashboard.module,
    title: dashboard.title,
    description: dashboard.description,
    scope: dashboard.scope,
  };
}

const analyticsDashboardRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/analytics/dashboards', async (request) => {
    requireRole(request, 'viewer');
    const actor = requireAuth(request);
    const enabled = new Set<string>(await listEnabledModules(actor.tenantId));
    const available = listDashboards().filter((d) => isDashboardAvailable(d, enabled));
    return ok(available.map(toSummary));
  });

  app.get('/v1/analytics/dashboards/:id', async (request) => {
    requireRole(request, 'viewer');
    const actor = requireAuth(request);
    const { id } = request.params as { id: string };

    const dashboard = getDashboard(id);
    if (!dashboard) throw notFound('Dashboard', id);

    // Gate on the owning module, so a disabled module's dashboard is 404 rather
    // than a screen of `unavailable` tiles.
    const enabled = new Set<string>(await listEnabledModules(actor.tenantId));
    if (!isDashboardAvailable(dashboard, enabled)) throw notFound('Dashboard', id);

    return ok(dashboard);
  });

  return Promise.resolve();
};

export default analyticsDashboardRoutes;
