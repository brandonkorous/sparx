// Funnels REST surface (docs/151, docs/152 B4) — API-first, so the workbench,
// the MCP server and anyone's own script are all consumers of the same routes.
//
//   GET    /v1/funnels                    → list (filter: property, status)
//   POST   /v1/funnels                    → create (always draft)
//   GET    /v1/funnels/:id                → one, with its ladder
//   PATCH  /v1/funnels/:id                → update
//   DELETE /v1/funnels/:id                → delete, and its counts with it
//   GET    /v1/funnels/:id/ladder         → the report: rungs, rates, value
//   POST   /v1/funnels/:id/stages         → record one person on one rung
//
// MODULE-GATED on `funnels`. It is a FREE module (docs/152 §1 #1), and free is
// not the same as ungated: a tenant who has not turned it on stores no rows and
// gets a clean MODULE_DISABLED rather than an empty list that reads like a
// campaign nobody built.
//
// ── WHY THERE IS NO PUBLIC WRITE HERE ───────────────────────────────────────
//
// The stage-recording route is STAFF-authenticated and deliberately does NOT run
// the visitor-hash attribution lookup that the public paths do. That is a
// correctness rule, not a shortcut: the lookup derives entry facts from the
// REQUEST's IP and user-agent, so running it here would attribute a lead to
// whichever staff member happened to type it in, using their own browsing. The
// public capture paths (`/v1/public/site/collect` and the form-submit stitch)
// are where the request genuinely belongs to the subject.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  CreateFunnelInput,
  FunnelRuleError,
  UpdateFunnelInput,
  buildLadder,
  createFunnel,
  deleteFunnel,
  getFunnel,
  listFunnels,
  recordStage,
  stagesOf,
  updateFunnel,
} from '@wizeworks/funnels';
import { isModuleEnabled } from '@wizeworks/auth';
import { ok } from '@wizeworks/api-core/envelope';
import { requireAuth, requireRole } from '@wizeworks/api-core/auth';
import { badRequest, moduleDisabled, notFound } from '@wizeworks/api-core/errors';
import type { StaffRole } from '@wizeworks/api-core/auth';

import { announceStage } from '@wizeworks/funnels/announce';
import { resolveListScope } from '../../../lib/property.js';

const IdParam = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  /** Which business's campaigns. A site id, or `all` for the tenant-wide list;
   *  absent falls back to the active site header. */
  property: z.string().min(1).max(63).optional(),
});

// The ladder's window. Defaults to the last 30 days, matching the other report
// surfaces so a reader moving between them compares like with like.
const LadderQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/**
 * A staff-recorded stage.
 *
 * `valueCents` IS accepted here, unlike on the public route, and the difference
 * is the authentication: a signed-in editor saying a booked job was worth $450
 * is the tenant's own bookkeeping. A visitor saying the same thing is a stranger
 * writing into the tenant's revenue reporting.
 */
const RecordStageBody = z.object({
  stageKey: z.string().min(1).max(63),
  customerId: z.string().uuid().optional(),
  subjectEmail: z.string().email().max(255).optional(),
  valueCents: z.number().int().nonnegative().optional(),
  refs: z.record(z.string(), z.string()).optional(),
  occurredAt: z.string().datetime().optional(),
});

/** Gate every route on the module flag. Free to run, still opt-in to have. */
async function requireFunnelsModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  if (!(await isModuleEnabled(auth.tenantId, 'funnels'))) throw moduleDisabled('funnels');
}

/** Tenant ctx after a role check — viewer to read, editor to write. */
async function ctxFor(
  request: FastifyRequest,
  min: StaffRole
): Promise<{ tenantId: string; userId: string }> {
  await requireFunnelsModule(request);
  const auth = requireRole(request, min);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

function resolveRange(input: { from?: string; to?: string }): { from: Date; to: Date } {
  return {
    from: input.from ? new Date(input.from) : new Date(Date.now() - 30 * 86_400_000),
    to: input.to ? new Date(input.to) : new Date(),
  };
}

/** A service-layer rule read as a 400 rather than escaping as a 500. These are
 *  answers to the caller ("say what this is trying to achieve first"), not
 *  faults — and the message is written to be shown to a person. */
function asBadRequest(err: unknown): never {
  if (err instanceof FunnelRuleError) throw badRequest(err.message);
  throw err;
}

const funnelRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/funnels', async (request) => {
    const ctx = await ctxFor(request, 'viewer');
    const q = ListQuery.parse(request.query);
    const propertyId = await resolveListScope(
      requireAuth(request),
      q.property,
      request.headers['x-sparx-property-id']
    );
    return ok(
      await listFunnels(ctx, {
        ...(propertyId ? { propertyId } : {}),
        ...(q.status ? { status: q.status } : {}),
      })
    );
  });

  app.post('/v1/funnels', async (request, reply) => {
    const ctx = await ctxFor(request, 'editor');
    const input = CreateFunnelInput.parse(request.body);
    const created = await createFunnel(ctx, input).catch(asBadRequest);
    reply.code(201);
    return ok(created);
  });

  app.get('/v1/funnels/:id', async (request) => {
    const ctx = await ctxFor(request, 'viewer');
    const { id } = IdParam.parse(request.params);
    const funnel = await getFunnel(ctx, id);
    if (!funnel) throw notFound('Funnel', id);
    // The ladder comes with it. A funnel without its rungs is a name and a
    // status, and every caller that fetches one wants to draw the shape.
    return ok({ ...funnel, stages: stagesOf(funnel) });
  });

  app.patch('/v1/funnels/:id', async (request) => {
    const ctx = await ctxFor(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const input = UpdateFunnelInput.parse(request.body);
    return ok(await updateFunnel(ctx, id, input).catch(asBadRequest));
  });

  app.delete('/v1/funnels/:id', async (request) => {
    const ctx = await ctxFor(request, 'editor');
    const { id } = IdParam.parse(request.params);
    // The rollup cascades with it, deliberately: those counts are keyed BY the
    // campaign, so a deleted funnel's rows are not history, they are numbers
    // every all-funnels total would keep adding in (docs/152 B2).
    await deleteFunnel(ctx, id);
    return ok({ id, deleted: true });
  });

  // The report. Both halves are counted from their own sources here — the
  // anonymous rungs from site traffic, everything below the capture line from
  // the stage rows — and every rate is `number | null`, never a defaulted zero.
  app.get('/v1/funnels/:id/ladder', async (request) => {
    const ctx = await ctxFor(request, 'viewer');
    const { id } = IdParam.parse(request.params);
    const funnel = await getFunnel(ctx, id);
    if (!funnel) throw notFound('Funnel', id);
    return ok(await buildLadder(ctx, funnel, resolveRange(LadderQuery.parse(request.query))));
  });

  app.post('/v1/funnels/:id/stages', async (request, reply) => {
    const ctx = await ctxFor(request, 'editor');
    const { id } = IdParam.parse(request.params);
    const body = RecordStageBody.parse(request.body);

    const row = await recordStage(ctx, {
      funnelId: id,
      stageKey: body.stageKey,
      customerId: body.customerId,
      subjectEmail: body.subjectEmail,
      valueCents: body.valueCents,
      refs: body.refs,
      ...(body.occurredAt ? { occurredAt: body.occurredAt } : {}),
    }).catch(asBadRequest);

    // Announced the same way a public capture is, so an automation cannot tell
    // (and should not care) whether a lead arrived through a form or was typed
    // in by somebody at the counter.
    await announceStage(request.log, ctx.tenantId, row);
    reply.code(201);
    return ok(row);
  });

  return Promise.resolve();
};

export default funnelRoutes;
