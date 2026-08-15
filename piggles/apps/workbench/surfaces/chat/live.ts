'use client';

// Live Chat realtime transport for the workbench — the socket the data layer's
// polling used to stand in for (see the note in data.ts).
//
// ONE socket per app instance. Every pane, docked or torn off into another
// window, lives in the MAIN window's React tree (popouts are portals — see
// app/popout/page.tsx), so a single connection shared by reference serves every
// chat pane in every window. There is no per-window connection to manage.
//
// It is ref-counted to the surfaces that need it — the inbox and the open
// thread. The first to mount connects it; the last to unmount tears it down
// after a short grace period, so an operator who never opens chat never holds a
// socket (and api-rest rejects the handshake for a tenant without the chat
// module anyway). While connected it is the PRIMARY freshness path: every server
// event is pushed straight into the ['chat', …] query cache the surfaces already
// read, so a message lands the instant api-rest broadcasts it. The polling in
// data.ts stays as a fallback, relaxed while we are live and tightened the moment
// the socket drops.

import { io, type Socket } from 'socket.io-client';
import { useQueryClient, type QueryClient } from '@sparx/query';
import { useEffect } from 'react';
import { getTokenState, peekToken } from '../../lib/api/token';
import { notifyTyping, setChatLive } from './live-status';
import {
  CHAT_KEYS,
  type ChatMessage,
  type ConversationDetail,
  type ConversationSummary,
} from './data';

export { useChatConnected, useTypingIndicator } from './live-status';

// ── Wire contract (client half) ─────────────────────────────────────────────
// api-rest can't be imported by the frontend (it would drag server deps into the
// bundle), so the /ws/chat event maps are redeclared here — the same duplication
// the widget and the REST DTOs already live with. Keep in sync with
// services/api-rest/src/websocket/chat-protocol.ts. Payload shapes reuse the DTO
// types data.ts already mirrors.
interface ServerToClientEvents {
  'message:new': (message: ChatMessage) => void;
  'conversation:updated': (conversation: ConversationSummary) => void;
  typing: (payload: { conversationId: string; from: 'staff' | 'ai' | 'customer' }) => void;
  read: (payload: { conversationId: string; by: 'staff' | 'customer' }) => void;
  error: (payload: { message: string }) => void;
}
interface ClientToServerEvents {
  'conversation:join': (conversationId: string, ack?: (ok: boolean) => void) => void;
  typing: (payload: { conversationId: string }) => void;
  read: (payload: { conversationId: string }) => void;
}
type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ── Singleton state ─────────────────────────────────────────────────────────
let socket: ChatSocket | null = null;
let connecting: Promise<void> | null = null;
let refCount = 0;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
let queryClient: QueryClient | null = null;
/** Conversation rooms an open thread wants — re-joined on every (re)connect. */
const joined = new Set<string>();

/** Keep the socket for this long after the last chat pane closes, so flipping
 *  between the inbox and a thread (or reordering panes) never thrashes it. */
const TEARDOWN_GRACE_MS = 15_000;
/** Don't spam the server with a typing event on every keystroke. */
const TYPING_THROTTLE_MS = 2_000;

// ── Cache sync (the socket → react-query seam) ───────────────────────────────

function onMessageNew(message: ChatMessage): void {
  if (!queryClient) return;
  // Append to the open thread if we're holding it — an instant paint, no refetch.
  queryClient.setQueryData<ConversationDetail>(
    CHAT_KEYS.conversation(message.conversationId),
    (prev) => {
      if (!prev) return prev; // not loaded here → the list refresh + poll will fetch it
      if (prev.messages.some((m) => m.id === message.id)) return prev; // our own echo, or a dupe
      return {
        ...prev,
        messages: [...prev.messages, message],
        lastMessageAt: message.createdAt,
      };
    }
  );
  // Refresh the queue so the preview line, ordering, and unread counts move.
  void queryClient.invalidateQueries({ queryKey: CHAT_KEYS.conversationsRoot });
}

function onConversationUpdated(conversation: ConversationSummary): void {
  if (!queryClient) return;
  // Patch the detail cache's summary fields (status / assignee / preview) in place…
  queryClient.setQueryData<ConversationDetail>(CHAT_KEYS.conversation(conversation.id), (prev) =>
    prev ? { ...prev, ...conversation } : prev
  );
  // …and refresh the queue that shows the same fields.
  void queryClient.invalidateQueries({ queryKey: CHAT_KEYS.conversationsRoot });
}

// ── Connection lifecycle ─────────────────────────────────────────────────────

function attachHandlers(active: ChatSocket): void {
  active.on('connect', () => {
    setChatLive(true);
    // Rooms are lost across a reconnect — re-enter the ones a thread still wants.
    for (const id of joined) active.emit('conversation:join', id);
    // Catch up on anything broadcast while we were away.
    if (queryClient) {
      void queryClient.invalidateQueries({ queryKey: CHAT_KEYS.conversationsRoot });
    }
  });

  active.on('disconnect', () => {
    // Polling in data.ts tightens back up the moment this flips (isChatLive()).
    setChatLive(false);
  });

  // The handshake reuses the token captured at connect time; refresh the cache so
  // the NEXT attempt (auth callback below reads peekToken()) carries a live one.
  active.io.on('reconnect_attempt', () => {
    void getTokenState();
  });
  active.on('connect_error', () => {
    void getTokenState();
  });

  active.on('message:new', onMessageNew);
  active.on('conversation:updated', onConversationUpdated);
  active.on('typing', ({ conversationId }) => {
    // The server only sends this to the OTHER sockets in the room, so any typing
    // event we receive is someone else — the visitor, the AI, or a teammate.
    notifyTyping(conversationId);
  });
  active.on('read', ({ conversationId }) => {
    if (queryClient) {
      void queryClient.invalidateQueries({ queryKey: CHAT_KEYS.conversation(conversationId) });
    }
  });
  active.on('error', () => {
    // A server-side chat error (e.g. a rejected send). The fallback poll still
    // keeps the cache honest, so there is nothing to recover here.
  });
}

async function ensureConnected(): Promise<void> {
  if (socket || connecting) return;
  connecting = (async () => {
    // Primes the token cache (peekToken below reads it) and gives us the api-rest
    // origin the /ws/chat server is attached to.
    const state = await getTokenState();
    // Released while we awaited the token — don't open a connection nobody wants.
    if (refCount === 0) return;
    const active: ChatSocket = io(state.apiUrl, {
      path: '/ws/chat',
      transports: ['websocket'],
      auth: (cb) => {
        // Called on every (re)connect. Hand the freshest cached token so a
        // reconnect after the JWT rotated never authenticates with a dead one.
        cb({ token: peekToken() ?? state.token });
      },
    });
    attachHandlers(active);
    socket = active;
  })().finally(() => {
    connecting = null;
  });
  await connecting;
}

function teardown(): void {
  disconnectTimer = null;
  if (refCount > 0) return; // re-acquired during the grace window
  socket?.disconnect();
  socket = null;
  joined.clear();
  setChatLive(false);
}

function acquire(client: QueryClient): void {
  queryClient = client;
  refCount += 1;
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  void ensureConnected();
}

function release(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && !disconnectTimer) {
    disconnectTimer = setTimeout(teardown, TEARDOWN_GRACE_MS);
  }
}

// ── Room membership + outbound typing ────────────────────────────────────────

function joinConversation(id: string): void {
  joined.add(id);
  socket?.emit('conversation:join', id);
}

function leaveConversation(id: string): void {
  // No server 'leave' exists — staying in the room is harmless (we just stop
  // re-joining it on reconnect). Dropping it here also stops tracking its typing.
  joined.delete(id);
}

let lastTypingSentAt = 0;
/** Announce that the operator is typing, so the visitor's widget shows it.
 *  Throttled — the composer calls this on keystrokes. */
export function emitTyping(conversationId: string): void {
  const now = Date.now();
  if (now - lastTypingSentAt < TYPING_THROTTLE_MS) return;
  lastTypingSentAt = now;
  socket?.emit('typing', { conversationId });
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Keeps the chat socket alive while this surface is mounted, and — when a
 * `conversationId` is given — joins that conversation's room so the thread
 * receives its typing and read events. The inbox calls it with no id (it only
 * needs the tenant-level inbox broadcasts, which every staff socket gets).
 */
export function useChatLive(conversationId?: string): void {
  const client = useQueryClient();

  useEffect(() => {
    acquire(client);
    return () => {
      release();
    };
  }, [client]);

  useEffect(() => {
    if (!conversationId) return;
    joinConversation(conversationId);
    return () => {
      leaveConversation(conversationId);
    };
  }, [conversationId]);
}
