// Live Chat — /ws/chat socket handlers + auth (docs/56, docs/69 A-2).
//
// Two kinds of socket authenticate on the handshake:
//   • staff   — handshake.auth.token is the same internal JWT the REST API
//               trusts; joins the tenant room + may join any conversation room
//               in its tenant.
//   • visitor — handshake.auth = { tenant: slug, conversationId, chatToken };
//               the chatToken must match the conversation's visitor_token. The
//               socket is pinned to that one conversation room.
//
// Persisting + the tenant/RLS scope reuse the same conversation-service the REST
// routes call, so the WebSocket path can never diverge from the HTTP path.

import { jwtVerify } from 'jose';
import type { FastifyBaseLogger } from 'fastify';
import type { Server, Socket } from 'socket.io';
import { prisma } from '@wizeworks/db';
import { isModuleEnabled } from '@wizeworks/auth';

import { env } from '../env.js';
import { conversationService } from '../lib/chat/index.js';
import { handleInboundForAI } from '../lib/chat/ai-handler.js';
import type { ChatBroadcaster } from '../lib/chat/broadcaster.js';
import {
  conversationRoom,
  tenantRoom,
  type ChatMessageDto,
  type ChatSocketData,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
} from './chat-protocol.js';

type ChatServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  ChatSocketData
>;
type ChatSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  ChatSocketData
>;

const jwtSecret = new TextEncoder().encode(env.SPARX_INTERNAL_JWT_SECRET);

async function verifyStaff(token: string): Promise<{ tenantId: string; userId: string }> {
  const { payload } = await jwtVerify(token, jwtSecret, { algorithms: ['HS256'] });
  const tid = typeof payload.tid === 'string' ? payload.tid : null;
  const sub = typeof payload.sub === 'string' ? payload.sub : null;
  if (!tid || !sub) throw new Error('token missing claims');
  return { tenantId: tid, userId: sub };
}

async function resolveTenantSlug(slug: string): Promise<string | null> {
  const row = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!row || row.id === '00000000-0000-0000-0000-000000000000') return null;
  return row.id;
}

export function registerChatHandlers(
  io: ChatServer,
  broadcaster: ChatBroadcaster,
  logger: FastifyBaseLogger
): void {
  io.use((socket, next) => {
    void authenticate(socket)
      .then(() => next())
      .catch((err: unknown) => next(err instanceof Error ? err : new Error('unauthorized')));
  });

  io.on('connection', (socket) => {
    const data = socket.data;
    if (data.kind === 'staff') {
      void socket.join(tenantRoom(data.tenantId));
    } else if (data.conversationId) {
      void socket.join(conversationRoom(data.conversationId));
    }

    socket.on('conversation:join', (conversationId, ack) => {
      if (data.kind !== 'staff') {
        ack?.(false);
        return;
      }
      // Confirm the conversation belongs to this tenant before joining (RLS in
      // get() enforces it — a miss throws and we ack false).
      void conversationService
        .get({ tenantId: data.tenantId, userId: data.userId }, conversationId, { messageTake: 1 })
        .then(async () => {
          await socket.join(conversationRoom(conversationId));
          ack?.(true);
        })
        .catch(() => ack?.(false));
    });

    socket.on('message:send', (payload, ack) => {
      void handleMessageSend(socket, broadcaster, payload, logger)
        .then(ack)
        .catch((err: unknown) => {
          ack?.({ error: err instanceof Error ? err.message : 'send failed' });
        });
    });

    socket.on('typing', (payload) => {
      socket.to(conversationRoom(payload.conversationId)).emit('typing', {
        conversationId: payload.conversationId,
        from: data.kind === 'staff' ? 'staff' : 'customer',
      });
    });

    socket.on('read', (payload) => {
      const reader = data.kind === 'staff' ? 'staff' : 'customer';
      void conversationService
        .markRead({ tenantId: data.tenantId, userId: data.userId }, payload.conversationId, reader)
        .then(() => {
          socket
            .to(conversationRoom(payload.conversationId))
            .emit('read', { conversationId: payload.conversationId, by: reader });
        })
        .catch(() => undefined);
    });
  });
}

async function authenticate(socket: ChatSocket): Promise<void> {
  const auth = (socket.handshake.auth ?? {}) as Record<string, unknown>;

  if (typeof auth.token === 'string' && auth.token) {
    const { tenantId, userId } = await verifyStaff(auth.token);
    if (!(await isModuleEnabled(tenantId, 'chat'))) throw new Error('chat module disabled');
    socket.data = { kind: 'staff', tenantId, userId };
    return;
  }

  if (
    typeof auth.tenant === 'string' &&
    typeof auth.conversationId === 'string' &&
    typeof auth.chatToken === 'string'
  ) {
    const tenantId = await resolveTenantSlug(auth.tenant);
    if (!tenantId) throw new Error('unknown tenant');
    if (!(await isModuleEnabled(tenantId, 'chat'))) throw new Error('chat module disabled');
    // Throws (forbidden/notFound) when the token doesn't match — rejects the
    // socket with that message.
    await conversationService.assertVisitorToken({ tenantId }, auth.conversationId, auth.chatToken);
    socket.data = { kind: 'visitor', tenantId, conversationId: auth.conversationId };
    return;
  }

  throw new Error('unauthorized');
}

async function handleMessageSend(
  socket: ChatSocket,
  broadcaster: ChatBroadcaster,
  payload: { conversationId: string; body: string },
  logger: FastifyBaseLogger
): Promise<ChatMessageDto> {
  const data = socket.data;
  const body = (payload.body ?? '').trim();
  if (!body) throw new Error('empty message');
  if (data.kind === 'visitor' && payload.conversationId !== data.conversationId) {
    throw new Error('forbidden');
  }
  const ctx = { tenantId: data.tenantId, userId: data.userId };
  const message =
    data.kind === 'staff'
      ? await conversationService.addMessage(ctx, payload.conversationId, {
          senderType: 'staff',
          senderId: data.userId,
          body,
        })
      : await conversationService.addMessage(ctx, payload.conversationId, {
          senderType: 'customer',
          senderId: null,
          body,
        });
  broadcaster.messageCreated(data.tenantId, payload.conversationId, message);
  // A visitor message gets the AI first-responder (answers or escalates).
  if (data.kind === 'visitor') {
    void handleInboundForAI({ tenantId: data.tenantId }, payload.conversationId, logger);
  }
  return message;
}
