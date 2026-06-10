'use client';

// Live Chat storefront widget (docs/56, docs/69 A-4).
//
// A self-contained floating bubble + slide-up panel. It fetches its public
// config, opens a conversation against api-rest's /v1/public/chat surface, and
// receives staff/AI replies live over the /ws/chat socket. Anonymous visitors
// are identified by an opaque visitor token persisted in localStorage; the
// pre-chat form (name/email) shows when the tenant enabled collectEmail.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { STYLE_ELEMENT_ID, WIDGET_CSS } from './styles.js';
import type {
  ChatMessage,
  ChatWidgetProps,
  ClientToServerEvents,
  PublicChatConfig,
  ServerToClientEvents,
} from './types.js';

type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface StoredConversation {
  id: string;
  token: string;
}

function injectStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ELEMENT_ID;
  el.textContent = WIDGET_CSS;
  document.head.appendChild(el);
}

function isAgent(m: ChatMessage): boolean {
  return m.senderType !== 'customer';
}

export function ChatWidget(props: ChatWidgetProps): React.JSX.Element | null {
  const { apiUrl, tenantSlug, accentColor, source = 'storefront', title = 'Chat' } = props;
  const storageKey = `sparx_chat:${tenantSlug}`;

  const [config, setConfig] = useState<PublicChatConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<StoredConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [preName, setPreName] = useState('');
  const [preEmail, setPreEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);

  const socketRef = useRef<ChatSocket | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const base = apiUrl.replace(/\/$/, '');
  const tenantQuery = `tenant=${encodeURIComponent(tenantSlug)}`;

  const addMessage = useCallback((m: ChatMessage) => {
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

  // Mount: inject styles, load config + any stored conversation.
  useEffect(() => {
    injectStyles();
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
        const json = (await res.json()) as { data: { messages: ChatMessage[] } };
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

  // Auto-scroll + clear unread when opening.
  useEffect(() => {
    if (open) {
      setUnread(0);
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, messages]);

  const accent = config?.primaryColor ?? accentColor ?? null;
  const rootStyle = useMemo<React.CSSProperties | undefined>(
    () => (accent ? { ['--sxchat-accent' as string]: accent } : undefined),
    [accent]
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
        data: { conversation: { id: string; messages: ChatMessage[] }; visitorToken: string };
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

  const send = useCallback(async () => {
    const body = input.trim();
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
          const json = (await res.json()) as { data: ChatMessage };
          addMessage(json.data);
        }
      }
      setInput('');
    } catch {
      /* leave the input so the visitor can retry */
    } finally {
      setSending(false);
    }
  }, [input, sending, conversation, startConversation, base, tenantQuery, addMessage]);

  if (!config?.enabled) return null;

  const needsPreChat = !conversation && config.collectEmail;

  return (
    <div className="sxchat-root" data-position={config.position} style={rootStyle}>
      {open ? (
        <div className="sxchat-panel" role="dialog" aria-label={`${title} window`}>
          <div className="sxchat-header">
            <div>
              <div className="sxchat-header-title">{title}</div>
              <div className="sxchat-header-status">{config.online ? 'Online' : 'Away'}</div>
            </div>
            <button className="sxchat-close" aria-label="Close chat" onClick={() => setOpen(false)}>
              <CloseIcon />
            </button>
          </div>

          {needsPreChat ? (
            <form
              className="sxchat-form"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <div className="sxchat-greeting">{config.greeting}</div>
              <input
                className="sxchat-input"
                placeholder="Your name (optional)"
                value={preName}
                onChange={(e) => setPreName(e.target.value)}
              />
              <input
                className="sxchat-input"
                type="email"
                placeholder="Email (optional)"
                value={preEmail}
                onChange={(e) => setPreEmail(e.target.value)}
              />
              <textarea
                className="sxchat-textarea"
                rows={3}
                placeholder="How can we help?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button className="sxchat-btn" type="submit" disabled={sending || !input.trim()}>
                {sending ? 'Sending…' : 'Start chat'}
              </button>
            </form>
          ) : (
            <>
              <div className="sxchat-thread">
                {messages.length === 0 ? (
                  <div className="sxchat-greeting">{config.greeting}</div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`sxchat-row ${m.senderType === 'customer' ? 'customer' : 'agent'}`}
                    >
                      <div className="sxchat-msg">{m.body}</div>
                    </div>
                  ))
                )}
                {typing ? <div className="sxchat-typing">typing…</div> : null}
                <div ref={threadEndRef} />
              </div>
              {!config.online ? <div className="sxchat-away">{config.awayMessage}</div> : null}
              <div className="sxchat-composer">
                <textarea
                  className="sxchat-textarea"
                  rows={1}
                  placeholder="Type a message…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <button
                  className="sxchat-send"
                  aria-label="Send message"
                  disabled={sending || !input.trim()}
                  onClick={() => void send()}
                >
                  <SendIcon />
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button className="sxchat-bubble" aria-label="Open chat" onClick={() => setOpen(true)}>
          <ChatIcon />
          {unread > 0 ? <span className="sxchat-unread">{unread}</span> : null}
        </button>
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SendIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m22 2-7 20-4-9-9-4Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2 11 13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
