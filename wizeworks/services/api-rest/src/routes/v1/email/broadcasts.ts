// Email broadcasts — segment-targeted marketing campaigns.
//
//   GET    /v1/email/broadcasts                 → list
//   POST   /v1/email/broadcasts                 → create (draft)
//   GET    /v1/email/broadcasts/estimate        → recipient estimate (?segment_id=)
//   GET    /v1/email/broadcasts/:id             → one
//   PATCH  /v1/email/broadcasts/:id             → update (draft only)
//   GET    /v1/email/broadcasts/:id/stats       → engagement counts
//   GET    /v1/email/broadcasts/:id/preview     → the send itself, rendered
//   POST   /v1/email/broadcasts/:id/send        → send now
//   POST   /v1/email/broadcasts/:id/schedule    → schedule
//   POST   /v1/email/broadcasts/:id/cancel      → cancel a scheduled send

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { broadcastService } from '@wizeworks/email-platform';
import { emailService } from '@wizeworks/builder';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireAuth, requireRole } from '@wizeworks/api-core/auth';
import { requireEmailModule, toEmailContext } from '../../../lib/email-context.js';
import { requireVerifiedEmail } from '../../../lib/verified-email-guard.js';
import { silicaEmailDataResolver } from '../../../lib/email-data.js';
import { buildFrom, loadSenderIdentity, renderBuilderEmailDoc } from '../../../lib/tenant-email.js';
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

  // What this broadcast will actually look like in somebody's inbox.
  //
  // Rendered through `renderBuilderEmailDoc` — the SAME core the dispatch tick
  // runs — for a REAL person out of this broadcast's own audience, so the
  // subject's merge tags resolve against a real name and the marketing footer
  // (unsubscribe + postal address) is the one that will ship. The email
  // designer's own preview answers a different question: it renders the
  // DESIGN's subject, without the broadcast's, and without the legal footer a
  // marketing send composes in. Proofreading one and sending the other is how
  // an owner ends up surprised by her own email.
  app.get('/v1/email/broadcasts/:id/preview', async (request) => {
    requireRole(request, 'viewer');
    await requireEmailModule(request);
    const { id } = IdParam.parse(request.params);
    const ctx = toEmailContext(request);
    const broadcast = await broadcastService.get(ctx, id);
    if (!broadcast.builderEmailId) {
      return ok({ ready: false, reason: 'no-email' as const });
    }
    const doc = await emailService.getPublishedById(ctx, broadcast.builderEmailId);
    if (!doc) return ok({ ready: false, reason: 'not-published' as const });
    // A real recipient, or nobody — previewing as an invented person would prove
    // the tags render, not that they render right.
    const recipient = await broadcastService.previewRecipient(ctx, id);
    if (!recipient) return ok({ ready: false, reason: 'no-audience' as const });

    const identity = await loadSenderIdentity(ctx.tenantId, broadcast.propertyId);
    const rendered = await renderBuilderEmailDoc(ctx, {
      doc,
      to: recipient.email,
      propertyId: broadcast.propertyId,
      ref: { email: recipient.email, customerId: recipient.customerId },
      // A broadcast is marketing, always — the same declaration the send makes.
      marketing: true,
      physicalAddress: identity.physicalAddress,
      subjectOverride: broadcast.subject,
      preheaderOverride: broadcast.preheader,
    });
    return ok({
      ready: true as const,
      to: recipient.email,
      from: await buildFrom(ctx.tenantId, identity.fromName, identity.fromAddress),
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
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
