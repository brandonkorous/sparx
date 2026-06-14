// Live Chat — public storefront widget routes (docs/56, docs/69 A-1).
//
//   GET  /v1/public/chat/config?tenant=slug                     → widget config
//   POST /v1/public/chat/conversations?tenant=slug              → start a thread
//   GET  /v1/public/chat/conversations/:id?tenant=slug          → reconnect/load
//   POST /v1/public/chat/conversations/:id/messages?tenant=slug → visitor message
//
// No staff auth (on the public router). The tenant is identified by the
// `?tenant=<slug>` query param; a per-conversation `x-chat-token` proves the
// visitor owns the thread on every call after creation. Rate-limited by the
// shared rate-limit plugin. The AI handler (A-3) hooks into the message POST.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@sparx/api-core/envelope';

import { publicChatContext, readChatToken } from '../../../lib/chat-context.js';
import {
  conversationService,
  getChatConfig,
  isWithinOperatingHours,
  PostMessageInput,
} from '../../../lib/chat/index.js';
import { getChatBroadcaster } from '../../../lib/chat/broadcaster.js';
import { handleInboundForAI } from '../../../lib/chat/ai-handler.js';

const PathId = z.object({ id: z.string().uuid() });

const StartInput = z.object({
  visitorName: z.string().max(255).optional(),
  visitorEmail: z.string().email().max(255).optional(),
  subject: z.string().max(255).optional(),
  // 'storefront' is the pre-rename legacy alias of 'site' (store→site); tolerated
  // so old cached widgets keep working, normalized to 'site' before storage.
  source: z.enum(['site', 'sparx_market', 'storefront']).optional(),
  message: z.string().min(1).max(8000),
});

const publicChatRoutes: FastifyPluginAsync = (app) => {
  // Public-safe slice of the config the widget needs to render, plus a live
  // online/offline flag derived from operating hours.
  app.get('/v1/public/chat/config', async (request) => {
    const { tenantId } = await publicChatContext(request);
    const config = await getChatConfig(tenantId);
    return ok({
      enabled: true,
      online: isWithinOperatingHours(config),
      collectEmail: config.collectEmail,
      greeting: config.greeting,
      awayMessage: config.awayMessage,
      primaryColor: config.primaryColor,
      position: config.position,
    });
  });

  app.post('/v1/public/chat/conversations', async (request, reply) => {
    const { ctx } = await publicChatContext(request);
    const input = StartInput.parse(request.body);
    const visitorToken = conversationService.generateVisitorToken();
    const { conversation } = await conversationService.create(ctx, {
      subject: input.subject,
      source: input.source === 'storefront' ? 'site' : (input.source ?? 'site'),
      visitorName: input.visitorName,
      visitorEmail: input.visitorEmail,
      visitorToken,
      message: { body: input.message, senderType: 'customer' },
    });
    const opening = conversation.messages[conversation.messages.length - 1];
    if (opening) getChatBroadcaster()?.messageCreated(ctx.tenantId, conversation.id, opening);
    // Fire-and-forget AI first response (answers or escalates). Never blocks
    // the widget's request; the reply arrives over WebSocket / on next fetch.
    void handleInboundForAI(ctx, conversation.id, request.log);
    reply.code(201);
    // The token is returned ONCE — the widget persists it (localStorage) and
    // sends it back via x-chat-token on every subsequent call.
    return ok({ conversation, visitorToken });
  });

  app.get('/v1/public/chat/conversations/:id', async (request) => {
    const { ctx } = await publicChatContext(request);
    const { id } = PathId.parse(request.params);
    await conversationService.assertVisitorToken(ctx, id, readChatToken(request));
    // Visitor opening the thread reads any staff/AI replies.
    await conversationService.markRead(ctx, id, 'customer');
    const conversation = await conversationService.get(ctx, id);
    return ok(conversation);
  });

  app.post('/v1/public/chat/conversations/:id/messages', async (request, reply) => {
    const { ctx } = await publicChatContext(request);
    const { id } = PathId.parse(request.params);
    const { customerId } = await conversationService.assertVisitorToken(
      ctx,
      id,
      readChatToken(request)
    );
    const input = PostMessageInput.parse(request.body);
    const message = await conversationService.addMessage(ctx, id, {
      senderType: 'customer',
      senderId: customerId,
      body: input.body,
      attachments: input.attachments,
    });
    getChatBroadcaster()?.messageCreated(ctx.tenantId, id, message);
    void handleInboundForAI(ctx, id, request.log);
    reply.code(201);
    return ok(message);
  });

  return Promise.resolve();
};

export default publicChatRoutes;
