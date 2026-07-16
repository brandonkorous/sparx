'use client';

// Live Chat storefront widget (docs/56, docs/69 A-4).
//
// A floating bubble + slide-up panel, built on silicaui's chat suite
// (ChatLayoutMessages/ChatMessage/ChatTypingIndicator/ChatComposer) — the
// launcher button and panel chrome have no chat-suite equivalent, so those
// stay hand-composed from Button/Indicator/Badge + silicaui's own tokens
// (bg-base-100, border-base-300, …), the same pattern @sparx/ui's MiniCart
// uses for its own floating panel. It fetches its public config, opens a
// conversation against api-rest's /v1/public/chat surface, and receives
// staff/AI replies live over the /ws/chat socket. Anonymous visitors are
// identified by an opaque visitor token persisted in localStorage; the
// pre-chat form (name/email) shows when the tenant enabled collectEmail.
//
// A tenant's accent color (config.primaryColor / the accentColor prop) is
// applied as a scoped --color-primary override on the widget root — the
// "my own outgoing message" bubble and the launcher/header ride --color-
// primary, so a single override re-themes the whole widget without touching
// the host page's own theme (needed on apps/web's marketplace CTA, where the
// host page is sparx's own brand, not the publisher tenant's).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  Badge,
  Button,
  ChatComposer,
  ChatLayoutMessages,
  ChatMessage,
  ChatTypingIndicator,
  Indicator,
  IndicatorItem,
  Input,
  Textarea,
} from '@wizeworks/silicaui-react';

import type {
  ChatMessage as ChatMessageDto,
  ChatWidgetProps,
  ClientToServerEvents,
  PublicChatConfig,
  ServerToClientEvents,
} from './types';

type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface StoredConversation {
  id: string;
  token: string;
}

/** Black or white, whichever reads better on a `#rrggbb` fill (WCAG relative
 *  luminance) — the fallback when a config predates `primaryColorContent` or
 *  the host supplies a raw `accentColor` prop with no paired content color. */
function readableContentOn(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return '#ffffff';
  const channel = (h: string): number => {
    const s = parseInt(h, 16) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const hexDigits = m[1] ?? '000000';
  const l =
    0.2126 * channel(hexDigits.slice(0, 2)) +
    0.7152 * channel(hexDigits.slice(2, 4)) +
    0.0722 * channel(hexDigits.slice(4, 6));
  const onBlack = (l + 0.05) / 0.05;
  const onWhite = 1.05 / (l + 0.05);
  return onBlack >= onWhite ? '#000000' : '#ffffff';
}

function isAgent(m: ChatMessageDto): boolean {
  return m.senderType !== 'customer';
}

export function ChatWidget(props: ChatWidgetProps): React.JSX.Element | null {
  const {
    apiUrl,
    tenantSlug,
    accentColor,
    source = 'site',
    title = 'Chat',
    hideLauncher = false,
    onOpenChange,
  } = props;
  const storageKey = `sparx_chat:${tenantSlug}`;

  const [config, setConfig] = useState<PublicChatConfig | null>(null);
  // Open state is optionally controlled: when the parent passes `open`, it owns
  // the value (e.g. an external "Chat with {publisher}" CTA); otherwise the
  // widget self-manages via its launcher bubble.
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpenControlled = props.open !== undefined;
  const open = isOpenControlled ? props.open! : internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (!isOpenControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isOpenControlled, onOpenChange]
  );
  const [conversation, setConversation] = useState<StoredConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [input, setInput] = useState('');
  const [preName, setPreName] = useState('');
  const [preEmail, setPreEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);

  const socketRef = useRef<ChatSocket | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const base = apiUrl.replace(/\/$/, '');
  const tenantQuery = `tenant=${encodeURIComponent(tenantSlug)}`;

  const addMessage = useCallback((m: ChatMessageDto) => {
    if (seenIds.current.has(m.id)) return;
    seenIds.current.add(m.id);
    setMessages((prev) => [...prev, m]);
    if (!openRef.current && isAgent(m)) setUnread((n) => n + 1);
  }, []);

  const connectSocket = useCallback(
    (conv: StoredConversation) => {
      if (socketRef.current) return;
      const socket: ChatSocket = io(base, {
        path: '/ws/chat',
        transports: ['websocket'],
        auth: { tenant: tenantSlug, conversationId: conv.id, chatToken: conv.token },
      });
      socket.on('message:new', addMessage);
      socket.on('typing', (p) => {
        if (p.from === 'customer') return;
        setTyping(true);
        window.setTimeout(() => setTyping(false), 2500);
      });
      socketRef.current = socket;
    },
    [base, tenantSlug, addMessage]
  );

  // Mount: load config + any stored conversation.
  useEffect(() => {
    let cancelled = false;

    async function boot(): Promise<void> {
      try {
        const res = await fetch(`${base}/v1/public/chat/config?${tenantQuery}`);
        if (!res.ok) return;
        const json = (await res.json()) as { data: PublicChatConfig };
        if (cancelled) return;
        setConfig(json.data);
      } catch {
        return;
      }

      let stored: StoredConversation | null = null;
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) stored = JSON.parse(raw) as StoredConversation;
      } catch {
        stored = null;
      }
      if (!stored || cancelled) return;

      try {
        const res = await fetch(
          `${base}/v1/public/chat/conversations/${stored.id}?${tenantQuery}`,
          {
            headers: { 'x-chat-token': stored.token },
          }
        );
        if (!res.ok) {
          window.localStorage.removeItem(storageKey);
          return;
        }
        const json = (await res.json()) as { data: { messages: ChatMessageDto[] } };
        if (cancelled) return;
        for (const m of json.data.messages) seenIds.current.add(m.id);
        setMessages(json.data.messages);
        setConversation(stored);
        connectSocket(stored);
      } catch {
        return;
      }
    }

    void boot();
    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [base, tenantQuery, storageKey, connectSocket]);

  const accent = config?.primaryColor ?? accentColor ?? null;
  const accentContent = config?.primaryColorContent ?? (accent ? readableContentOn(accent) : null);
  const rootStyle = useMemo<React.CSSProperties | undefined>(
    () =>
      accent
        ? ({
            '--color-primary': accent,
            '--color-primary-content': accentContent ?? '#ffffff',
          } as React.CSSProperties)
        : undefined,
    [accent, accentContent]
  );

  const persist = useCallback(
    (conv: StoredConversation) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(conv));
      } catch {
        /* storage may be blocked — the widget still works for this session */
      }
    },
    [storageKey]
  );

  const startConversation = useCallback(
    async (body: string): Promise<void> => {
      const res = await fetch(`${base}/v1/public/chat/conversations?${tenantQuery}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: body,
          source,
          ...(preName ? { visitorName: preName } : {}),
          ...(preEmail ? { visitorEmail: preEmail } : {}),
        }),
      });
      if (!res.ok) throw new Error('start failed');
      const json = (await res.json()) as {
        data: { conversation: { id: string; messages: ChatMessageDto[] }; visitorToken: string };
      };
      const conv: StoredConversation = {
        id: json.data.conversation.id,
        token: json.data.visitorToken,
      };
      for (const m of json.data.conversation.messages) seenIds.current.add(m.id);
      setMessages(json.data.conversation.messages);
      setConversation(conv);
      persist(conv);
      connectSocket(conv);
    },
    [base, tenantQuery, source, preName, preEmail, persist, connectSocket]
  );

  const send = useCallback(
    async (body: string) => {
      if (!body || sending) return;
      setSending(true);
      try {
        if (!conversation) {
          await startConversation(body);
        } else {
          const res = await fetch(
            `${base}/v1/public/chat/conversations/${conversation.id}/messages?${tenantQuery}`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-chat-token': conversation.token },
              body: JSON.stringify({ body }),
            }
          );
          if (res.ok) {
            const json = (await res.json()) as { data: ChatMessageDto };
            addMessage(json.data);
          }
        }
        setInput('');
      } catch {
        // ChatComposer clears its draft optimistically on submit — restore it
        // so the message isn't lost when the send actually fails.
        setInput(body);
      } finally {
        setSending(false);
      }
    },
    [sending, conversation, startConversation, base, tenantQuery, addMessage]
  );

  if (!config?.enabled) return null;

  const needsPreChat = !conversation && config.collectEmail;

  return (
    <div
      className="fixed bottom-5 z-[2147483000] font-sans"
      data-position={config.position}
      style={{
        ...rootStyle,
        [config.position === 'bottom-left' ? 'left' : 'right']: '20px',
      }}
    >
      {open ? (
        <div
          className="border-base-300 bg-base-100 flex h-[520px] max-h-[calc(100vh-6rem)] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border shadow-2xl"
          role="dialog"
          aria-label={`${title} window`}
        >
          <div className="bg-primary text-primary-content flex items-center justify-between gap-2 px-4 py-3">
            <div>
              <div className="text-sm font-semibold">{title}</div>
              <div className="text-xs opacity-85">{config.online ? 'Online' : 'Away'}</div>
            </div>
            <button
              type="button"
              className="rounded-md p-1 hover:bg-white/15"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>

          {needsPreChat ? (
            <form
              className="flex flex-col gap-2.5 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input.trim());
              }}
            >
              <p className="text-base-content text-sm">{config.greeting}</p>
              <Input
                color="primary"
                placeholder="Your name (optional)"
                value={preName}
                onChange={(e) => setPreName(e.target.value)}
              />
              <Input
                color="primary"
                type="email"
                placeholder="Email (optional)"
                value={preEmail}
                onChange={(e) => setPreEmail(e.target.value)}
              />
              <Textarea
                color="primary"
                rows={3}
                placeholder="How can we help?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <Button type="submit" color="primary" disabled={sending || !input.trim()}>
                {sending ? 'Sending…' : 'Start chat'}
              </Button>
            </form>
          ) : (
            <>
              <ChatLayoutMessages className="flex-1 space-y-1 p-4">
                {messages.length === 0 ? (
                  <p className="text-base-content px-1 text-sm">{config.greeting}</p>
                ) : (
                  messages.map((m) => (
                    <ChatMessage
                      key={m.id}
                      side={m.senderType === 'customer' ? 'end' : 'start'}
                      color={m.senderType === 'customer' ? 'primary' : undefined}
                    >
                      {m.body}
                    </ChatMessage>
                  ))
                )}
                {typing ? <ChatTypingIndicator side="start" name="Agent is typing" /> : null}
              </ChatLayoutMessages>
              {!config.online ? (
                <p className="text-base-content border-base-300 border-t px-4 py-2.5 text-xs">
                  {config.awayMessage}
                </p>
              ) : null}
              <div className="border-base-300 border-t p-2">
                <ChatComposer
                  value={input}
                  onValueChange={setInput}
                  onSend={(value) => void send(value)}
                  disabled={sending}
                  placeholder="Type a message…"
                />
              </div>
            </>
          )}
        </div>
      ) : hideLauncher ? null : (
        <Indicator>
          {unread > 0 ? (
            <IndicatorItem>
              <Badge color="error" size="xs">
                {unread}
              </Badge>
            </IndicatorItem>
          ) : null}
          <Button
            shape="circle"
            color="primary"
            aria-label="Open chat"
            className="h-14 w-14 shadow-lg"
            onClick={() => {
              setUnread(0);
              setOpen(true);
            }}
          >
            <ChatIcon />
          </Button>
        </Indicator>
      )}
    </div>
  );
}

function ChatIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path
        d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8 8.38 8.38 0 0 1 8.5-8.5A8.38 8.38 0 0 1 21 11.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
