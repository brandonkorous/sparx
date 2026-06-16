// Automation engine REST surface (docs/81 §5/§6, docs/84 Slice G backend) — the
// API-first authoring + observability path for the cross-module rule engine. The
// dashboard, MCP, and external SDKs are all consumers of these endpoints.
//
// Automations are a PLATFORM CAPABILITY, not a gated module (docs/81 §3): there
// is no `automations` slug, so these routes do ROLE checks only (viewer to read,
// editor to write) — no `requireModule`. The tier model is enforced in the
// service: a LOCKED (platform-managed) automation rejects edit / status / delete
// (→ AUTOMATION_LOCKED → 409); the tenant path for adapting one is "Duplicate to
// edit" (POST /:id/clone, which forks a user-origin editable copy). A tenant can
// never create a `system`/`locked` rule — origin/locked are service-set.
//
//   GET    /v1/automations                  → list (filter: status, triggerType, origin)
//   POST   /v1/automations                  → create (always user-origin, draft)
//   GET    /v1/automations/:id              → one
//   PATCH  /v1/automations/:id              → update
//   DELETE /v1/automations/:id              → delete
//   POST   /v1/automations/:id/clone        → fork an editable copy
//   POST   /v1/automations/:id/status       → set status (draft|active|paused)
//   GET    /v1/automations/:id/versions     → published-version history
//   POST   /v1/automations/:id/publish      → promote the staged draft → next version
//   POST   /v1/automations/:id/restore      → restore a version into the draft
//   POST   /v1/automations/:id/discard-draft→ throw away the staged draft
//   GET    /v1/automations/:id/runs         → recent run history
//   GET    /v1/automations/:id/runs/:runId  → one run + its steps (gate_log audit)

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  AutomationNotFoundError,
  automationsOverview,
  cloneAutomation,
  createAutomation,
  deleteAutomation,
  discardDraft,
  getAutomation,
  getAutomationRun,
  listAutomationRuns,
  listAutomations,
  listAutomationVersions,
  publishAutomation,
  restoreAutomationVersion,
  runsTimeseries,
  setAutomationStatus,
  updateAutomation,
  type ServiceCtx,
} from '@sparx/automation';
import {
  CloneAutomationInput,
  CreateAutomationInput,
  PublishAutomationInput,
  RestoreAutomationVersionInput,
  UpdateAutomationInput,
} from '@sparx/automation-schemas';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound } from '@sparx/api-core/errors';
import type { StaffRole } from '@sparx/api-core/auth';

const IdParam = z.object({ id: z.string().uuid() });
const RunParams = z.object({ id: z.string().uuid(), runId: z.string().uuid() });

const ListQuery = z.object({
  status: z.string().max(20).optional(),
  triggerType: z.string().max(100).optional(),
  origin: z.enum(['user', 'system']).optional(),
});

const RunsQuery = z.object({
  status: z.string().max(20).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

// Run-activity timeseries (docs/97 §5). Accepts ?from=&to= (ISO 8601) and
// defaults to the last 30 days when both are omitted — matches the dashboard's
// presets so the surface is forgiving.
const RunsTimeseriesQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  grain: z.enum(['day', 'week', 'month']).optional(),
});

function resolveRange(input: { from?: string; to?: string }): { from: string; to: string } {
  const to = input.to ?? new Date().toISOString();
  const from = input.from ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
  return { from, to };
}

const StatusBody = z.object({ status: z.enum(['draft', 'active', 'paused']) });

/** Resolve the tenant service-ctx after a role check (write paths use 'editor',
 *  reads use 'viewer'). `userId` lets the service stamp the actor on writes. */
function ctxFor(request: FastifyRequest, min: StaffRole): ServiceCtx {
  const auth = requireRole(request, min);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

const automationRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/automations', async (request) => {
    const ctx = ctxFor(request, 'viewer');
    const filter = ListQuery.parse(request.query);
    return ok(await listAutomations(ctx, filter));
  });

  app.post('/v1/automations', async (request, reply) => {
    const ctx = ctxFor(request, 'editor');
    const input = CreateAutomationInput.parse(request.body);
    const created = await createAutomation(ctx, input);
    reply.code(201);
    return ok(created);
  });

  // Aggregate run-activity timeseries across every automation the tenant owns
  // (docs/97 §5). Static segment, so it never collides with `/:id`. Viewer-read,
  // matching the per-automation `/:id/runs` list. Backed by the
  // `rollup_automation_daily_runs` rollup with a live overlay of today.
  app.get('/v1/automations/reports/runs', async (request) => {
    const ctx = ctxFor(request, 'viewer');
    const q = RunsTimeseriesQuery.parse(request.query);
    const range = resolveRange(q);
    return ok(await runsTimeseries(ctx, { range, ...(q.grain ? { grain: q.grain } : {}) }));
  });

  // Every automation + its trailing-window run count / success rate (docs/97 §5)
  // — the AI overview's "Automations & agents" table. Static segment, viewer-read.
  app.get('/v1/automations/reports/summary', async (request) => {
    const ctx = ctxFor(request, 'viewer');
    return ok(await automationsOverview(ctx, { sinceDays: 30 }));
  });

  app.get('/v1/automations/:id', async (request) => {
    const ctx = ctxFor(request, 'viewer');
    const { id } = IdParam.parse(request.params);
    const automation = await getAutomation(ctx, id);
    if (!automation) throw new AutomationNotFoundError(id);
    return ok(automation);
  });

  app.patch('/v1/automations/:id', async (request) => {
    const ctx = ctxFor(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const input = UpdateAutomationInput.parse(request.body);
    return ok(await updateAutomation(ctx, id, input));
  });

  app.delete('/v1/automations/:id', async (request) => {
    const ctx = ctxFor(request, 'editor');
    const { id } = IdParam.parse(request.params);
    await deleteAutomation(ctx, id);
    return ok({ id, deleted: true });
  });

  app.post('/v1/automations/:id/clone', async (request, reply) => {
    const ctx = ctxFor(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const input = CloneAutomationInput.parse(request.body ?? {});
    const clone = await cloneAutomation(ctx, id, input);
    reply.code(201);
    return ok(clone);
  });

  app.post('/v1/automations/:id/status', async (request) => {
    const ctx = ctxFor(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const { status } = StatusBody.parse(request.body);
    return ok(await setAutomationStatus(ctx, id, status));
  });

  // ── versioning (docs/84 Slice G-versioning) ──
  app.get('/v1/automations/:id/versions', async (request) => {
    const ctx = ctxFor(request, 'viewer');
    const { id } = IdParam.parse(request.params);
    // 404 the automation itself so an empty history isn't confused with a bad id.
    if (!(await getAutomation(ctx, id))) throw new AutomationNotFoundError(id);
    return ok(await listAutomationVersions(ctx, id));
  });

  app.post('/v1/automations/:id/publish', async (request) => {
    const ctx = ctxFor(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const { note } = PublishAutomationInput.parse(request.body ?? {});
    return ok(await publishAutomation(ctx, id, { note }));
  });

  app.post('/v1/automations/:id/restore', async (request) => {
    const ctx = ctxFor(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const { version } = RestoreAutomationVersionInput.parse(request.body);
    return ok(await restoreAutomationVersion(ctx, id, version));
  });

  app.post('/v1/automations/:id/discard-draft', async (request) => {
    const ctx = ctxFor(request, 'editor');
    const { id } = IdParam.parse(request.params);
    return ok(await discardDraft(ctx, id));
  });

  app.get('/v1/automations/:id/runs', async (request) => {
    const ctx = ctxFor(request, 'viewer');
    const { id } = IdParam.parse(request.params);
    const filter = RunsQuery.parse(request.query);
    // 404 if the automation itself doesn't exist, so an empty list isn't
    // confused with a bad id.
    if (!(await getAutomation(ctx, id))) throw new AutomationNotFoundError(id);
    return ok(await listAutomationRuns(ctx, id, filter));
  });

  app.get('/v1/automations/:id/runs/:runId', async (request) => {
    const ctx = ctxFor(request, 'viewer');
    const { id, runId } = RunParams.parse(request.params);
    const run = await getAutomationRun(ctx, id, runId);
    if (!run) throw notFound('AutomationRun', runId);
    return ok(run);
  });

  return Promise.resolve();
};

export default automationRoutes;
