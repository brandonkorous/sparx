// Web Push subscriptions (docs/69 A-6) — staff manage their own browser push
// subscriptions. NOT module-gated: push is a platform feature available to any
// authenticated staff user (it notifies them; the chat module decides what to
// send). push-worker reads these rows to deliver `push.send` notifications.
//
//   POST /v1/staff/push-subscriptions             → upsert the caller's subscription
//   POST /v1/staff/push-subscriptions/unsubscribe → remove one by endpoint

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@wizeworks/api-core/envelope';
import { requireAuth } from '@wizeworks/api-core/auth';
import { withRequestTenant } from '@wizeworks/api-core/db';

// The shape `PushSubscription.toJSON()` produces in the browser.
const SubscribeBody = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
  userAgent: z.string().max(400).optional(),
});

const UnsubscribeBody = z.object({
  endpoint: z.string().url().max(2048),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; route registration is sync.
const pushRoutes: FastifyPluginAsync = async (app) => {
  app.post('/v1/staff/push-subscriptions', async (request) => {
    const auth = requireAuth(request);
    const body = SubscribeBody.parse(request.body);
    const sub = await withRequestTenant(request, (tx) =>
      tx.pushSubscription.upsert({
        where: { tenantId_endpoint: { tenantId: auth.tenantId, endpoint: body.endpoint } },
        create: {
          tenantId: auth.tenantId,
          userId: auth.actorId,
          endpoint: body.endpoint,
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
          userAgent: body.userAgent ?? null,
        },
        // Re-subscribing the same browser (rotated keys, or a different staff
        // user signed in) re-points the row at the current user + keys.
        update: {
          userId: auth.actorId,
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
          userAgent: body.userAgent ?? null,
          lastSeenAt: new Date(),
        },
        select: { id: true },
      })
    );
    return ok({ id: sub.id, subscribed: true });
  });

  app.post('/v1/staff/push-subscriptions/unsubscribe', async (request) => {
    const auth = requireAuth(request);
    const body = UnsubscribeBody.parse(request.body);
    await withRequestTenant(request, (tx) =>
      tx.pushSubscription.deleteMany({
        where: { endpoint: body.endpoint, userId: auth.actorId },
      })
    );
    return ok({ subscribed: false });
  });
};

export default pushRoutes;
