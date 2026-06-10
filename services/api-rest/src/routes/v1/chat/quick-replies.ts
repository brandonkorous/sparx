// Live Chat — quick replies (canned responses) routes (docs/56, docs/69 A-1).
//
//   GET    /v1/chat/quick-replies      → list
//   POST   /v1/chat/quick-replies      → create
//   DELETE /v1/chat/quick-replies/:id  → delete
//
// Gated by requireModule('chat').

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';

import { requireChatModule, toChatContext } from '../../../lib/chat-context.js';
import { quickReplyService, CreateQuickReplyInput } from '../../../lib/chat/index.js';

const PathId = z.object({ id: z.string().uuid() });

const quickReplyRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/chat/quick-replies', async (request) => {
    requireRole(request, 'viewer');
    await requireChatModule(request);
    const items = await quickReplyService.list(toChatContext(request));
    return ok(items);
  });

  app.post('/v1/chat/quick-replies', async (request, reply) => {
    requireRole(request, 'editor');
    await requireChatModule(request);
    const input = CreateQuickReplyInput.parse(request.body);
    const created = await quickReplyService.create(toChatContext(request), input);
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
