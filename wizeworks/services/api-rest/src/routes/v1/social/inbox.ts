// The engagement inbox API (docs/social-audit slice 15) — the inbound half of the
// social module.
//
//   GET   /v1/social/inbox                → what needs answering        (viewer)
//   GET   /v1/social/inbox/count          → the badge number            (viewer)
//   GET   /v1/social/inbox/:id/thread     → one conversation, in order  (viewer)
//   POST  /v1/social/inbox/:id/reply      → answer it                   (editor)
//   PATCH /v1/social/inbox/:id            → archive / reopen            (editor)
//
// Replying is two-phase on purpose: this route WRITES the reply as an outbound row and
// emits `social.inbox.reply`; the social-worker sends it to the platform. That keeps the
// platform call off the request path (the same split publishing uses) and makes the row
// — not the message — the idempotency anchor, so a redelivery can never post a second
// answer to a customer.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { notFound } from '@wizeworks/api-core/errors';
import { publish } from '@wizeworks/api-core/pubsub';
import {
  composeInboxReply,
  countOpenInboxItems,
  getInboxThread,
  listInboxItems,
  setInboxItemStatus,
} from '@wizeworks/social/service';
import {
  requireSocialModule,
  resolveSocialProperty,
  toSocialContext,
} from '../../../lib/social-context.js';

const PathId = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  status: z.enum(['open', 'replied', 'archived']).optional(),
  kind: z.enum(['comment', 'mention', 'review', 'message']).optional(),
  socialTargetId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const ReplyBody = z.object({ text: z.string().min(1).max(5000) });
const StatusBody = z.object({ status: z.enum(['open', 'archived']) });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const socialInboxRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/social/inbox', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'viewer');
    const query = ListQuery.parse(request.query);
    const items = await listInboxItems(toSocialContext(request), {
      ...query,
      propertyId: await resolveSocialProperty(request),
    });
    return reply.send(ok({ items }));
  });

  // Just the number, for the nav badge — a full list read to render a count would be
  // a page of rows fetched to show one integer.
  app.get('/v1/social/inbox/count', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'viewer');
    const open = await countOpenInboxItems(
      toSocialContext(request),
      await resolveSocialProperty(request)
    );
    return reply.send(ok({ open }));
  });

  app.get('/v1/social/inbox/:id/thread', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    const items = await getInboxThread(toSocialContext(request), id);
    if (items.length === 0) throw notFound('inbox item', id);
    return reply.send(ok({ items }));
  });

  app.post('/v1/social/inbox/:id/reply', async (request, reply) => {
    await requireSocialModule(request);
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const { text } = ReplyBody.parse(request.body);
    const ctx = toSocialContext(request);
    const created = await composeInboxReply(ctx, id, text);
    if (!created) throw notFound('inbox item', id);
    // Hand the platform call to the worker.
    await publish(request.log, 'social.inbox.reply', ctx.tenantId, auth.actorId, {
      itemId: created.id,
    });
    return reply.status(202).send(ok(created));
  });

  app.patch('/v1/social/inbox/:id', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const { status } = StatusBody.parse(request.body);
    const item = await setInboxItemStatus(toSocialContext(request), id, status);
    if (!item) throw notFound('inbox item', id);
    return reply.send(ok(item));
  });
};

export default socialInboxRoutes;
