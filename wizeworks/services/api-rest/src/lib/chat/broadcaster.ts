// Live Chat — route → WebSocket decoupling (docs/56, docs/69 A-2).
//
// REST handlers persist a message/update, then call getChatBroadcaster()?.… so
// the change reaches live sockets WITHOUT the route importing socket.io. The
// WebSocket layer (websocket/index.ts) installs the real implementation at boot;
// in tests (no WS attached) the getter returns null and the call is a no-op.

import type { ChatMessageDto, ConversationSummaryDto } from './conversation-service.js';

export interface ChatBroadcaster {
  /** A new message landed on a conversation — fan out to the thread + inbox. */
  messageCreated(tenantId: string, conversationId: string, message: ChatMessageDto): void;
  /** Conversation metadata changed (status / assignment) — refresh the inbox. */
  conversationUpdated(tenantId: string, conversation: ConversationSummaryDto): void;
}

let current: ChatBroadcaster | null = null;

export function setChatBroadcaster(broadcaster: ChatBroadcaster | null): void {
  current = broadcaster;
}

export function getChatBroadcaster(): ChatBroadcaster | null {
  return current;
}
