'use client';

// Live Chat dashboard — shared socket context (docs/69 A-5).
//
// Owns ONE /ws/chat connection for the whole inbox. The conversation list and
// the open thread both consume it: a staff socket auto-joins its tenant room on
// the server, so `message:new` / `conversation:updated` for every conversation
// in the tenant arrive here and drive the live list; the thread additionally
// joins its conversation room (via joinConversation) for `typing`.

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import type { ChatMessageDto, ConversationSummaryDto, SenderType } from '../_lib/types';

interface ServerToClientEvents {
  'message:new': (message: ChatMessageDto) => void;
  'conversation:updated': (conversation: ConversationSummaryDto) => void;
  typing: (payload: { conversationId: string; from: SenderType }) => void;
  read: (payload: { conversationId: string; by: 'staff' | 'customer' }) => void;
}
interface ClientToServerEvents {
  'conversation:join': (conversationId: string, ack?: (ok: boolean) => void) => void;
  read: (payload: { conversationId: string }) => void;
}

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface ChatSocketContextValue {
  socket: ChatSocket | null;
  connected: boolean;
  joinConversation: (conversationId: string) => void;
  markRead: (conversationId: string) => void;
}

const ChatSocketContext = createContext<ChatSocketContextValue>({
  socket: null,
  connected: false,
  joinConversation: () => undefined,
  markRead: () => undefined,
});

export function useChatSocket(): ChatSocketContextValue {
  return useContext(ChatSocketContext);
}

export function ChatSocketProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [socket, setSocket] = useState<ChatSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<ChatSocket | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect(): Promise<void> {
      try {
        const res = await fetch('/api/chat/ws-token', { cache: 'no-store' });
        if (!res.ok) return;
        const { token, apiUrl } = (await res.json()) as { token: string; apiUrl: string };
        if (cancelled || !apiUrl) return;

        const s: ChatSocket = io(apiUrl, {
          path: '/ws/chat',
          transports: ['websocket'],
          auth: { token },
        });
        s.on('connect', () => setConnected(true));
        s.on('disconnect', () => setConnected(false));
        socketRef.current = s;
        setSocket(s);
      } catch {
        /* inbox still works without live updates — list reloads on navigation */
      }
    }

    void connect();
    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const value: ChatSocketContextValue = {
    socket,
    connected,
    joinConversation: (id) => socketRef.current?.emit('conversation:join', id),
    markRead: (id) => socketRef.current?.emit('read', { conversationId: id }),
  };

  return <ChatSocketContext.Provider value={value}>{children}</ChatSocketContext.Provider>;
}
