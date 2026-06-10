// Live Chat — WebSocket wire contract (docs/56, docs/69 A-2).
//
// The typed socket.io event maps shared by the `/ws/chat` server. The widget
// (@sparx/chat-widget) and the dashboard useChat hook each redeclare the same
// shapes on their side — api-rest can't be imported by frontends (it would drag
// server deps into the bundle), so the contract is duplicated across the
// client/server boundary the way the REST DTOs already are. Keep the three in
// sync. Payloads are JSON-serializable (DTOs already stringify dates).

import type { ChatMessageDto, ConversationSummaryDto } from '../lib/chat/conversation-service.js';

export type { ChatMessageDto, ConversationSummaryDto };

export interface ServerToClientEvents {
  'message:new': (message: ChatMessageDto) => void;
  'conversation:updated': (conversation: ConversationSummaryDto) => void;
  typing: (payload: { conversationId: string; from: 'staff' | 'ai' | 'customer' }) => void;
  read: (payload: { conversationId: string; by: 'staff' | 'customer' }) => void;
  error: (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  // Staff sockets join individual conversation rooms on demand; visitor sockets
  // are pinned to their one conversation at connect time (join is a no-op).
  'conversation:join': (conversationId: string, ack?: (ok: boolean) => void) => void;
  'message:send': (
    payload: { conversationId: string; body: string },
    ack?: (result: ChatMessageDto | { error: string }) => void
  ) => void;
  typing: (payload: { conversationId: string }) => void;
  read: (payload: { conversationId: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface ChatSocketData {
  kind: 'staff' | 'visitor';
  tenantId: string;
  /** Staff user id (staff sockets only). */
  userId?: string;
  /** The single conversation a visitor socket is bound to. */
  conversationId?: string;
}

/** Room a staff socket joins to receive inbox-level events for its tenant. */
export function tenantRoom(tenantId: string): string {
  return `tenant:${tenantId}`;
}

/** Room every participant of one conversation joins for thread-level events. */
export function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}
