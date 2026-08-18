// Live Chat — quick replies (canned responses) routes (docs/56, docs/69 A-1).
//
//   GET    /v1/chat/quick-replies      → list
//   POST   /v1/chat/quick-replies      → create
//   DELETE /v1/chat/quick-replies/:id  → delete
//
// Gated by requireModule('chat').

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';

import { requireChatModule, toChatContext } from '../../../lib/chat-context.js';
import { quickReplyService, CreateQuickReplyInput } from '../../../lib/chat/index.js';
import { resolvePropertyId } from '../../../lib/property.js';

const PathId = z.object({ id: z.string().uuid() });

const quickReplyRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/chat/quick-replies', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireChatModule(request);
    // This site's replies plus the tenant-wide ones (docs/131 §3.7).
    const propertyId = await resolvePropertyId(
      auth,
      request.headers['x-sparx-property-id'] as string | undefined
    );
    const items = await quickReplyService.list(toChatContext(request), propertyId);
    return ok(items);
  });

  app.post('/v1/chat/quick-replies', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    await requireChatModule(request);
    const input = CreateQuickReplyInput.parse(request.body);
    const propertyId = await resolvePropertyId(
      auth,
      request.headers['x-sparx-property-id'] as string | undefined
    );
    const created = await quickReplyService.create(toChatContext(request), {
      ...input,
      // An omitted propertyId defaults to the site being worked in; only an
      // EXPLICIT null makes it tenant-wide. Defaulting the other way would make
      // every reply leak to every business unless the author remembered — the
      // exact failure this change exists to end.
      propertyId: input.propertyId === undefined ? propertyId : input.propertyId,
    });
    reply.code(201);
    return ok(created);
  });

  app.delete('/v1/chat/quick-replies/:id', async (request, reply) => {
    requireRole(request, 'editor');
    await requireChatModule(request);
    const { id } = PathId.parse(request.params);
    await quickReplyService.remove(toChatContext(request), id);
    reply.code(204);
  });

  return Promise.resolve();
};

export default quickReplyRoutes;
