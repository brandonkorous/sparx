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
import { broadcastService } from '@wizeworks/email-platform';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireAuth, requireRole } from '@wizeworks/api-core/auth';
import { requireEmailModule, toEmailContext } from '../../../lib/email-context.js';
import { requireVerifiedEmail } from '../../../lib/verified-email-guard.js';
import { silicaEmailDataResolver } from '../../../lib/email-data.js';
import { resolvePropertyId, reachableSiteIds } from '../../../lib/property.js';

const IdParam = z.object({ id: z.string().uuid() });
const EstimateQuery = z.object({ segment_id: z.string().uuid().optional() });

const ListBroadcastsQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const emailBroadcastRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/email/broadcasts', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireEmailModule(request);
    const q = ListBroadcastsQuery.parse(request.query);
    const { items, total } = await broadcastService.list(toEmailContext(request), {
      q: q.q,
      // Bound to the member's reachable sites (docs/131 §3.3).
      propertyIds: reachableSiteIds(auth),
      take: q.take,
      skip: q.skip,
    });
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  app.get('/v1/email/broadcasts/estimate', async (request) => {
    requireRole(request, 'viewer');
    await requireEmailModule(request);
    const q = EstimateQuery.parse(request.query);
    const ctx = toEmailContext(request);
    // Estimate against the SAME site the send will target (docs/49 Phase 7), so the
    // count the composer shows is the audience the broadcast actually reaches — a
    // tenant-wide count here would promise Site B's customers to a Site A campaign.
    const requested = request.headers['x-sparx-property-id'];
    const propertyId = await resolvePropertyId(
      requireAuth(request),
      typeof requested === 'string' ? requested : null
    );
    return ok(await broadcastService.estimateRecipients(ctx, q.segment_id ?? null, propertyId));
  });

  app.post('/v1/email/broadcasts', async (request, reply) => {
    requireRole(request, 'editor');
    await requireEmailModule(request);
    const ctx = toEmailContext(request);
    // The broadcast is sent on behalf of the active site (docs/49 Phase 7) — the
    // `x-sparx-property-id` the dashboard switcher sets, else the primary.
    const requested = request.headers['x-sparx-property-id'];
    const propertyId = await resolvePropertyId(
      requireAuth(request),
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
    // The broadcast body is a published Builder email (docs/52);
    // silicaEmailDataResolver resolves its bound sources — once for a per-send body,
    // per recipient (at dispatch) for a personalized one.
    return ok(await broadcastService.sendNow(ctx, id, silicaEmailDataResolver(ctx)));
  });

  app.post('/v1/email/broadcasts/:id/schedule', async (request) => {
    requireRole(request, 'editor');
    await requireEmailModule(request);
    await requireVerifiedEmail(request);
    const { id } = IdParam.parse(request.params);
    const ctx = toEmailContext(request);
    return ok(await broadcastService.schedule(ctx, id, request.body, silicaEmailDataResolver(ctx)));
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
