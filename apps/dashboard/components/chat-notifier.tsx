'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { toast } from '@sparx/ui';

// Global live-chat notifier — mounted once in DashboardShell (same pattern as
// UpdateNotifier), so a staff member gets notified of a new customer message
// no matter what module they're in, not just while on /chat/inbox. Owns its
// own minimal socket connection rather than reusing ChatSocketProvider's
// (which only mounts inside /chat/inbox and is wired for the conversation
// list + open thread, not a route-independent toast) — keeping the two
// separate avoids touching that already-working plumbing for an additive
// feature.

interface ChatMessagePayload {
  id: string;
  conversationId: string;
  senderType: 'customer' | 'staff' | 'ai';
  body: string;
}

function truncate(body: string, max = 120): string {
  return body.length > max ? `${body.slice(0, max - 1)}…` : body;
}

export function ChatNotifier({ enabled }: { enabled: boolean }): null {
  const pathname = usePathname();
  const router = useRouter();
  // Read via a ref so the socket effect below (intentionally empty deps —
  // it should connect once, not reconnect on every navigation) always sees
  // the CURRENT route when a message arrives, not the one at connect time.
  const pathnameRef = React.useRef(pathname);
  React.useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let socket: Socket | null = null;

    async function connect(): Promise<void> {
      try {
        const res = await fetch('/api/chat/ws-token', { cache: 'no-store' });
        if (!res.ok) return;
        const { token, apiUrl } = (await res.json()) as { token: string; apiUrl: string };
        if (cancelled || !apiUrl) return;

        socket = io(apiUrl, { path: '/ws/chat', transports: ['websocket'], auth: { token } });
        socket.on('message:new', (m: ChatMessagePayload) => {
          if (m.senderType !== 'customer') return;
          // The inbox list already shows new messages live (bump-to-top +
          // unread badge) — a toast on top of that is redundant noise.
          if (pathnameRef.current?.startsWith('/chat/inbox')) return;

          toast('New chat message', {
            id: `chat-${m.conversationId}`,
            description: truncate(m.body),
            duration: 8000,
            action: {
              label: 'View',
              onClick: () => router.push(`/chat/inbox/${m.conversationId}`),
            },
          });
        });
      } catch {
        /* no live notifications this session — non-critical */
      }
    }

    void connect();
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [enabled, router]);

  return null;
}
