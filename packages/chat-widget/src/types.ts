// Live Chat widget — shared client types (docs/56, docs/69 A-4).
//
// Mirrors the api-rest wire contract (services/api-rest/src/websocket/
// chat-protocol.ts + lib/chat DTOs). api-rest can't be imported here, so the
// contract is duplicated across the client/server boundary — keep them in sync.

export type SenderType = 'customer' | 'staff' | 'ai';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderType: SenderType;
  senderId: string | null;
  body: string;
  attachments: unknown;
  aiGenerated: boolean;
  aiConfidence: number | null;
  readAt: string | null;
  createdAt: string;
}

export interface PublicChatConfig {
  enabled: boolean;
  online: boolean;
  collectEmail: boolean;
  greeting: string;
  awayMessage: string;
  primaryColor: string | null;
  position: 'bottom-right' | 'bottom-left';
}

export interface ServerToClientEvents {
  'message:new': (message: ChatMessage) => void;
  typing: (payload: { conversationId: string; from: SenderType }) => void;
  read: (payload: { conversationId: string; by: 'staff' | 'customer' }) => void;
  error: (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  'conversation:join': (conversationId: string, ack?: (ok: boolean) => void) => void;
  'message:send': (
    payload: { conversationId: string; body: string },
    ack?: (result: ChatMessage | { error: string }) => void
  ) => void;
  typing: (payload: { conversationId: string }) => void;
  read: (payload: { conversationId: string }) => void;
}

export interface ChatWidgetProps {
  /** Browser-reachable api-rest origin (e.g. https://api.sparx.works). */
  apiUrl: string;
  /** The tenant slug — identifies the tenant on every public call. */
  tenantSlug: string;
  /** Fallback accent when the tenant hasn't set a chat primaryColor. */
  accentColor?: string | null;
  /** Conversation source — 'site' (default) or 'sparx_market'. */
  source?: 'site' | 'sparx_market';
  /** Display name shown in the panel header (defaults to "Chat"). */
  title?: string;
  /** Hide the floating launcher bubble. The panel then opens only through the
   *  controlled `open` prop — for embedding behind an explicit CTA, e.g. the
   *  sparx.market "Chat with {publisher}" button. */
  hideLauncher?: boolean;
  /** Controlled open state. When provided, the parent owns open/close and must
   *  pair it with `onOpenChange`. Omit for the default self-managed bubble. */
  open?: boolean;
  /** Notified whenever the widget requests an open-state change (e.g. its close
   *  button). The required companion to a controlled `open`. */
  onOpenChange?: (open: boolean) => void;
}
