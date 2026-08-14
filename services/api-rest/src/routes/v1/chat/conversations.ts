// Live Chat — staff conversation routes (docs/56, docs/69 A-1).
//
//   GET    /v1/chat/conversations              → list (status / mine / search)
//   POST   /v1/chat/conversations              → create (staff-initiated)
//   GET    /v1/chat/conversations/:id          → conversation + messages
//   POST   /v1/chat/conversations/:id/messages → staff sends a message
//   PATCH  /v1/chat/conversations/:id          → assign / resolve / spam
//   POST   /v1/chat/conversations/:id/read     → mark inbound messages read
//   GET    /v1/chat/conversations/:id/context  → CRM customer context
//
// All routes gated by requireModule('chat'). A-2 layers WebSocket broadcast on
// top of the same service calls.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { queryBool } from '@sparx/api-core/query';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';

import { requireChatModule, toChatContext } from '../../../lib/chat-context.js';
import {
  conversationService,
  getCustomerContext,
  CreateConversationInput,
  PostMessageInput,
  UpdateConversationInput,
} from '../../../lib/chat/index.js';
import { getChatBroadcaster } from '../../../lib/chat/broadcaster.js';
import { resolveListScope, resolveListScopeIds } from '../../../lib/property.js';

const PathId = z.object({ id: z.string().uuid() });

const ListQuery = z.object({
  // A site id, or the literal `all` for the cross-site inbox (docs/131 §3.7).
  property: z.string().min(1).max(64).optional(),
  status: z.enum(['open', 'pending', 'resolved', 'spam']).optional(),
  mine: queryBool.optional(),
  assigned_to: z.string().uuid().optional(),
  q: z.string().max(255).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const MessageQuery = z.object({
  message_take: z.coerce.number().int().min(1).max(200).optional(),
  message_skip: z.coerce.number().int().min(0).optional(),
});

const conversationRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/chat/conversations', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireChatModule(request);
    const q = ListQuery.parse(request.query);
    // One site's inbox by default (docs/131 §3.7). `?property=all` widens to
    // every site THIS MEMBER may reach — resolveListScopeIds returns undefined
    // for an unrestricted caller (genuinely all) and the granted subset for a
    // restricted one, so the donut employee's "all" is still only donuts.
    const propertyId = await resolveListScope(
      auth,
      q.property,
      request.headers['x-sparx-property-id']
    );
    const propertyIds =
      q.property === 'all'
        ? await resolveListScopeIds(auth, q.property, request.headers['x-sparx-property-id'])
        : undefined;
    const { items, total } = await conversationService.list(toChatContext(request), {
      propertyId,
      propertyIds,
      status: q.status,
      mine: q.mine ?? false,
      assignedToId: q.assigned_to,
      q: q.q,
      take: q.take,
      skip: q.skip,
    });
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  app.post('/v1/chat/conversations', async (request, reply) => {
    requireRole(request, 'editor');
    await requireChatModule(request);
    const ctx = toChatContext(request);
    const input = CreateConversationInput.parse(request.body);
    const { conversation } = await conversationService.create(ctx, {
      customerId: input.customerId,
      subject: input.subject,
      source: 'dashboard',
      visitorName: input.visitorName,
      visitorEmail: input.visitorEmail,
      message: input.message
        ? { body: input.message, senderType: 'staff', senderId: ctx.userId }
        : undefined,
    });
    reply.code(201);
    return ok(conversation);
  });

  app.get('/v1/chat/conversations/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireChatModule(request);
    const { id } = PathId.parse(request.params);
    const q = MessageQuery.parse(request.query);
    const conversation = await conversationService.get(toChatContext(request), id, {
      messageTake: q.message_take,
      messageSkip: q.message_skip,
    });
    return ok(conversation);
  });

  app.post('/v1/chat/conversations/:id/messages', async (request, reply) => {
    requireRole(request, 'editor');
    await requireChatModule(request);
    const ctx = toChatContext(request);
    const { id } = PathId.parse(request.params);
    const input = PostMessageInput.parse(request.body);
    const message = await conversationService.addMessage(ctx, id, {
      senderType: 'staff',
      senderId: ctx.userId,
      body: input.body,
      attachments: input.attachments,
    });
    getChatBroadcaster()?.messageCreated(ctx.tenantId, id, message);
    reply.code(201);
    return ok(message);
  });

  app.patch('/v1/chat/conversations/:id', async (request) => {
    requireRole(request, 'editor');
    await requireChatModule(request);
    const ctx = toChatContext(request);
    const { id } = PathId.parse(request.params);
    const input = UpdateConversationInput.parse(request.body);
    const conversation = await conversationService.update(ctx, id, input);
    getChatBroadcaster()?.conversationUpdated(ctx.tenantId, conversation);
    return ok(conversation);
  });

  app.post('/v1/chat/conversations/:id/read', async (request) => {
    requireRole(request, 'editor');
    await requireChatModule(request);
    const { id } = PathId.parse(request.params);
    const result = await conversationService.markRead(toChatContext(request), id, 'staff');
    return ok(result);
  });

  app.get('/v1/chat/conversations/:id/context', async (request) => {
    requireRole(request, 'viewer');
    await requireChatModule(request);
    const { id } = PathId.parse(request.params);
    const context = await getCustomerContext(toChatContext(request), id);
    return ok(context);
  });

  return Promise.resolve();
};

export default conversationRoutes;
