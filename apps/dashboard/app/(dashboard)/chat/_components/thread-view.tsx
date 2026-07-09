'use client';

// Live Chat inbox — thread view (docs/69 A-5).
//
// Renders the message thread for one conversation and keeps it live via the
// shared chat socket. Sends + status/assignment changes go through server
// actions (which broadcast); the socket echo dedupes the sender's own message.
// "/" in the composer opens the quick-reply picker.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Badge, Textarea } from '@wizeworks/silicaui-react';
import { Check, UserCheck } from 'lucide-react';

import { useChatSocket } from './chat-socket-provider';
import {
  assignConversationAction,
  markConversationReadAction,
  sendChatMessageAction,
  setConversationStatusAction,
} from '../actions';
import type {
  ChatMessageDto,
  ConversationDetailDto,
  ConversationStatus,
  QuickReplyDto,
} from '../_lib/types';

const STATUS_COLOR: Record<ConversationStatus, string> = {
  open: 'info',
  pending: 'warning',
  resolved: 'success',
  spam: 'neutral',
};

export function ThreadView({
  conversation,
  currentUserId,
  quickReplies,
}: {
  conversation: ConversationDetailDto;
  currentUserId: string;
  quickReplies: QuickReplyDto[];
}): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessageDto[]>(conversation.messages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [status, setStatus] = useState<ConversationStatus>(conversation.status);
  const [assignedToId, setAssignedToId] = useState<string | null>(conversation.assignedToId);

  const seen = useRef<Set<string>>(new Set(conversation.messages.map((m) => m.id)));
  const endRef = useRef<HTMLDivElement | null>(null);
  const { socket, joinConversation, markRead } = useChatSocket();

  const id = conversation.id;

  // State resets per conversation via a `key` on this component in the route
  // page (remount), so no prop→state sync effect is needed here.

  useEffect(() => {
    joinConversation(id);
    markRead(id);
    void markConversationReadAction(id);
  }, [id, joinConversation, markRead]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (m: ChatMessageDto) => {
      if (m.conversationId !== id || seen.current.has(m.id)) return;
      seen.current.add(m.id);
      setMessages((prev) => [...prev, m]);
      if (m.senderType === 'customer') {
        markRead(id);
        void markConversationReadAction(id);
      }
    };
    const onTyping = (p: { conversationId: string; from: string }) => {
      if (p.conversationId !== id || p.from !== 'customer') return;
      setTyping(true);
      window.setTimeout(() => setTyping(false), 2500);
    };
    socket.on('message:new', onMessage);
    socket.on('typing', onTyping);
    return () => {
      socket.off('message:new', onMessage);
      socket.off('typing', onTyping);
    };
  }, [socket, id, markRead]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const quickMatches = useMemo(() => {
    if (!input.startsWith('/')) return [];
    const q = input.slice(1).toLowerCase();
    return quickReplies
      .filter(
        (r) => (r.shortcut?.toLowerCase().includes(q) ?? false) || r.title.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [input, quickReplies]);

  async function send(): Promise<void> {
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const message = await sendChatMessageAction(id, body);
      if (!seen.current.has(message.id)) {
        seen.current.add(message.id);
        setMessages((prev) => [...prev, message]);
      }
      setInput('');
    } finally {
      setSending(false);
    }
  }

  async function resolveToggle(): Promise<void> {
    const next: ConversationStatus = status === 'resolved' ? 'open' : 'resolved';
    const updated = await setConversationStatusAction(id, next);
    setStatus(updated.status);
  }

  async function assignToMe(): Promise<void> {
    const updated = await assignConversationAction(id, currentUserId);
    setAssignedToId(updated.assignedToId);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-base-300 flex items-center justify-between gap-3 border-b px-5 py-3">
        <div className="min-w-0">
          <div className="text-base-content truncate text-sm font-semibold">
            {conversation.customerName ?? conversation.customerEmail ?? 'Anonymous visitor'}
          </div>
          <Badge color={STATUS_COLOR[status]} variant="soft" size="sm">
            {status}
          </Badge>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {assignedToId !== currentUserId ? (
            <Button
              color="module"
              variant="soft"
              size="sm"
              iconStart={<UserCheck className="h-4 w-4" />}
              onClick={() => void assignToMe()}
            >
              Assign to me
            </Button>
          ) : null}
          <Button
            color={status === 'resolved' ? 'neutral' : 'success'}
            variant="soft"
            size="sm"
            iconStart={<Check className="h-4 w-4" />}
            onClick={() => void resolveToggle()}
          >
            {status === 'resolved' ? 'Reopen' : 'Resolve'}
          </Button>
        </div>
      </header>

      <div className="bg-base-200 flex-1 space-y-2 overflow-y-auto p-5">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.senderType === 'customer' ? 'justify-start' : 'justify-end'}`}
          >
            <div className="max-w-[72%]">
              <div
                className={`rounded-2xl px-3.5 py-2 text-sm ${
                  m.senderType === 'customer'
                    ? 'bg-base-100 text-base-content rounded-bl-sm'
                    : 'bg-module rounded-br-sm text-white'
                }`}
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {m.body}
              </div>
              <div className="text-base-content/70 mt-0.5 px-1 text-[11px]">
                {m.senderType === 'ai' ? 'AI' : m.senderType === 'staff' ? 'You' : ''}
              </div>
            </div>
          </div>
        ))}
        {typing ? <div className="text-base-content/70 px-1 text-xs italic">typing…</div> : null}
        <div ref={endRef} />
      </div>

      <div className="border-base-300 relative border-t p-3">
        {quickMatches.length > 0 ? (
          <div className="border-base-300 bg-base-100 absolute right-3 bottom-full left-3 mb-1 overflow-hidden rounded-lg border shadow-lg">
            {quickMatches.map((r) => (
              <button
                key={r.id}
                type="button"
                className="hover:bg-base-200 block w-full px-3 py-2 text-left text-sm"
                onClick={() => setInput(r.body)}
              >
                <span className="font-medium">{r.title}</span>
                {r.shortcut ? (
                  <span className="text-base-content/70 ml-2 text-xs">/{r.shortcut}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <Textarea
            rows={1}
            value={input}
            placeholder="Type a reply…  (/ for quick replies)"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button color="module" disabled={sending || !input.trim()} onClick={() => void send()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
