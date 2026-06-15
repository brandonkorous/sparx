'use client';

// Live Chat inbox — conversation list (docs/69 A-5).
//
// Server-rendered initial list, then kept live by the shared chat socket: a
// `message:new` on a known conversation bumps its snippet/unread and reorders
// it to the top; an unknown conversation (a brand-new thread) triggers a
// router.refresh() to re-pull the server list. Status tabs filter client-side.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Badge, Button } from '@sparx/ui';

import { useChatSocket } from './chat-socket-provider';
import type { ConversationStatus, ConversationSummaryDto } from '../_lib/types';

const TABS: { key: 'all' | 'open' | 'mine' | 'resolved'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'mine', label: 'Mine' },
  { key: 'resolved', label: 'Resolved' },
];

const STATUS_COLOR: Record<ConversationStatus, string> = {
  open: 'info',
  pending: 'warning',
  resolved: 'success',
  spam: 'neutral',
};

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return 'now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

export function ConversationList({
  initial,
  currentUserId,
}: {
  initial: ConversationSummaryDto[];
  currentUserId: string;
}): React.JSX.Element {
  const [items, setItems] = useState<ConversationSummaryDto[]>(initial);
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('all');
  const { socket } = useChatSocket();
  const router = useRouter();
  const pathname = usePathname();
  const activeId = pathname.startsWith('/chat/inbox/')
    ? pathname.slice('/chat/inbox/'.length)
    : null;

  // Re-sync to fresh server data when the layout re-fetches (router.refresh on a
  // brand-new conversation). React's sanctioned "adjust state during render"
  // pattern — not an effect, which would cascade renders.
  const [syncedInitial, setSyncedInitial] = useState(initial);
  if (initial !== syncedInitial) {
    setSyncedInitial(initial);
    setItems(initial);
  }

  useEffect(() => {
    if (!socket) return;
    const onMessage = (m: { conversationId: string; senderType: string; body: string }) => {
      setItems((prev) => {
        const idx = prev.findIndex((c) => c.id === m.conversationId);
        const current = idx === -1 ? undefined : prev[idx];
        if (!current) {
          router.refresh();
          return prev;
        }
        const updated: ConversationSummaryDto = {
          ...current,
          lastMessageSnippet: m.body.slice(0, 140),
          lastMessageAt: new Date().toISOString(),
          unreadStaff:
            m.senderType === 'customer' && current.id !== activeId
              ? current.unreadStaff + 1
              : current.unreadStaff,
        };
        const next = [...prev];
        next.splice(idx, 1);
        return [updated, ...next];
      });
    };
    const onUpdate = (c: ConversationSummaryDto) => {
      setItems((prev) => {
        const idx = prev.findIndex((x) => x.id === c.id);
        if (idx === -1) return [c, ...prev];
        const next = [...prev];
        next[idx] = c;
        return next;
      });
    };
    socket.on('message:new', onMessage);
    socket.on('conversation:updated', onUpdate);
    return () => {
      socket.off('message:new', onMessage);
      socket.off('conversation:updated', onUpdate);
    };
  }, [socket, router, activeId]);

  const filtered = useMemo(() => {
    switch (tab) {
      case 'open':
        return items.filter((c) => c.status === 'open' || c.status === 'pending');
      case 'mine':
        return items.filter((c) => c.assignedToId === currentUserId);
      case 'resolved':
        return items.filter((c) => c.status === 'resolved');
      default:
        return items.filter((c) => c.status !== 'spam');
    }
  }, [items, tab, currentUserId]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-[var(--color-border)] p-2">
        {TABS.map((t) => (
          <Button
            key={t.key}
            type="button"
            size="sm"
            color={tab === t.key ? 'module' : 'neutral'}
            variant={tab === t.key ? 'solid' : 'ghost'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-[var(--color-text-secondary)]">No conversations.</p>
        ) : (
          filtered.map((c) => (
            <Link
              key={c.id}
              href={`/chat/inbox/${c.id}`}
              className={`block border-b border-[var(--color-border)] px-4 py-3 ${
                c.id === activeId ? 'bg-[var(--module-active-tint)]' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                  {c.customerName ?? c.customerEmail ?? 'Anonymous visitor'}
                </span>
                <span className="shrink-0 text-xs text-[var(--color-text-secondary)]">
                  {timeAgo(c.lastMessageAt)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-[var(--color-text-secondary)]">
                  {c.lastMessageSnippet ?? 'No messages yet'}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {c.unreadStaff > 0 ? (
                    <Badge color="danger" variant="solid" size="sm">
                      {c.unreadStaff}
                    </Badge>
                  ) : null}
                  <Badge color={STATUS_COLOR[c.status]} variant="soft" size="sm">
                    {c.status}
                  </Badge>
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
