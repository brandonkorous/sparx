// Email broadcasts — segment-targeted marketing campaigns.
//
//   GET    /v1/email/broadcasts                 → list
//   POST   /v1/email/broadcasts                 → create (draft)
//   GET    /v1/email/broadcasts/estimate        → recipient estimate (?segment_id=)
//   GET    /v1/email/broadcasts/:id             → one
//   PATCH  /v1/email/broadcasts/:id             → update (draft only)
//   GET    /v1/email/broadcasts/:id/stats       → engagement counts
//   POST   /v1/email/broadcasts/:id/send        → send now
//   POST   /v1/email/broadcasts/:id/schedule    → schedule
//   POST   /v1/email/broadcasts/:id/cancel      → cancel a scheduled send

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { broadcastService } from '@sparx/email-platform';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireEmailModule, toEmailContext } from '../../../lib/email-context.js';
import { requireVerifiedEmail } from '../../../lib/verified-email-guard.js';
import { emailDataResolver } from '../../../lib/email-data.js';
import { resolvePropertyId } from '../../../lib/property.js';

const IdParam = z.object({ id: z.string().uuid() });
const EstimateQuery = z.object({ segment_id: z.string().uuid().optional() });

const ListBroadcastsQuery = z.object({
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const emailBroadcastRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/email/broadcasts', async (request) => {
    requireRole(request, 'viewer');
    await requireEmailModule(request);
    const q = ListBroadcastsQuery.parse(request.query);
    const { items, total } = await broadcastService.list(toEmailContext(request), {
      take: q.take,
      skip: q.skip,
    });
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  app.get('/v1/email/broadcasts/estimate', async (request) => {
    requireRole(request, 'viewer');
    await requireEmailModule(request);
    const q = EstimateQuery.parse(request.query);
    return ok(
      await broadcastService.estimateRecipients(toEmailContext(request), q.segment_id ?? null)
    );
  });

  app.post('/v1/email/broadcasts', async (request, reply) => {
    requireRole(request, 'editor');
    await requireEmailModule(request);
    const ctx = toEmailContext(request);
    // The broadcast is sent on behalf of the active site (docs/49 Phase 7) — the
    // `x-sparx-property-id` the dashboard switcher sets, else the primary.
    const requested = request.headers['x-sparx-property-id'];
    const propertyId = await resolvePropertyId(
      ctx.tenantId,
      typeof requested === 'string' ? requested : null
    );
    const row = await broadcastService.create(ctx, request.body, propertyId);
    reply.code(201);
    return ok(row);
  });

  app.get('/v1/email/broadcasts/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireEmailModule(request);
    const { id } = IdParam.parse(request.params);
    return ok(await broadcastService.get(toEmailContext(request), id));
  });

  app.patch('/v1/email/broadcasts/:id', async (request) => {
    requireRole(request, 'editor');
    await requireEmailModule(request);
    const { id } = IdParam.parse(request.params);
    return ok(await broadcastService.update(toEmailContext(request), id, request.body));
  });

  app.get('/v1/email/broadcasts/:id/stats', async (request) => {
    requireRole(request, 'viewer');
    await requireEmailModule(request);
    const { id } = IdParam.parse(request.params);
    return ok(await broadcastService.stats(toEmailContext(request), id));
  });

  app.post('/v1/email/broadcasts/:id/send', async (request) => {
    requireRole(request, 'editor');
    await requireEmailModule(request);
    await requireVerifiedEmail(request);
    const { id } = IdParam.parse(request.params);
    const ctx = toEmailContext(request);
    // The broadcast body is a published Builder email (docs/52); emailDataResolver
    // resolves its bound sources — once for a per-send body, per recipient (at
    // dispatch) for a personalized one.
    return ok(await broadcastService.sendNow(ctx, id, emailDataResolver(ctx)));
  });

  app.post('/v1/email/broadcasts/:id/schedule', async (request) => {
    requireRole(request, 'editor');
    await requireEmailModule(request);
    await requireVerifiedEmail(request);
    const { id } = IdParam.parse(request.params);
    const ctx = toEmailContext(request);
    return ok(await broadcastService.schedule(ctx, id, request.body, emailDataResolver(ctx)));
  });

  app.post('/v1/email/broadcasts/:id/cancel', async (request) => {
    requireRole(request, 'editor');
    await requireEmailModule(request);
    const { id } = IdParam.parse(request.params);
    return ok(await broadcastService.cancel(toEmailContext(request), id));
  });

  return Promise.resolve();
};

export default emailBroadcastRoutes;
