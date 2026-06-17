# sparx Platform — Live Chat Module Spec

**Version:** 1.1
**Author:** Brandon Korous
**Last Updated:** 2026-06-17

---

## 1. Overview

sparx Live Chat is a built-in customer communication module. Tenants get a branded chat widget on their site and a unified inbox in the dashboard — no Intercom, no Zendesk, no Crisp required. The AI layer handles common questions instantly; humans handle the rest.

**Module:** Chat · +$19/mo  
**Surfaces:** Site widget, tenant dashboard inbox, sparx.market product pages

---

## 2. Why Build It

Every sparx tenant currently solves customer support themselves. Options are:

- Ignore it (bad for conversion)
- Pay Intercom/Zendesk ($100–300/mo)
- Cobble together Facebook Messenger

A native chat widget that works out of the box — on their sparx.zone site and custom domain — is a retention feature. For sparx.market specifically, chat is essential: a shopper looking at a diesel injector has questions. A "Chat with Gillett Diesel" button is the difference between a bounce and a sale.

---

## 3. Three Surfaces

### Surface 1 — Site Widget

Floating chat bubble on tenant's site (sparx.zone or custom domain). Shopper opens conversation → tenant responds from dashboard inbox. Conversation history saved in CRM.

### Surface 2 — Tenant Dashboard Inbox

All customer conversations in one place. Assign to staff members. See customer's order history in sidebar. Quick replies, saved responses. Mobile push notifications.

### Surface 3 — sparx.market Chat

"Chat with [Tenant Name]" on product pages. Routes to that tenant's inbox. Shopper identified if they have a sparx account.

---

## 4. AI Layer

The chat widget is AI-first. Claude Haiku handles the first response:

```
Shopper: "Does this injector fit a 2019 Ford F-350 6.7L?"

AI (instant, reads product fitment data from Typesense):
  "Yes, this Bosch injector is compatible with the
   2019 Ford F-350 6.7L Power Stroke. It's also
   compatible with 2017–2022 F-250 and F-350 models
   with the same engine. Want me to add it to your cart?"

If AI can't answer confidently (confidence < 0.8):
  → Escalates to human: "Let me connect you with the team"
  → Tenant notified via push/email
```

**What the AI can answer from platform data:**

- Product fitment and compatibility
- Product availability and inventory
- Shipping policies and estimates
- Return/refund policies
- Order status (if customer is logged in)
- Store hours and contact info

**What always escalates to human:**

- Pricing negotiations
- Custom orders
- Complaints
- Anything the AI isn't confident about

---

## 5. Tech Stack

No third-party service required. Everything in the existing stack:

```
WebSockets        — real-time message delivery
                    socket.io on the API server

PostgreSQL        — conversation and message storage
                    already in stack, no new service

Redis pub/sub     — route messages to correct tenant dashboard
                    already in stack

React chat widget — @sparx/chat-widget package
                    embeds on site via Next.js component

AI layer          — Anthropic API (claude-haiku-4-5)
                    reads product data, fitment, policies
                    fast and cheap per message
```

---

## 6. Data Model

```sql
CREATE TABLE chat_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  customer_id     UUID REFERENCES customers(id),  -- null if anonymous
  status          VARCHAR(20) DEFAULT 'open',
  -- open | assigned | resolved | spam
  assigned_to     UUID REFERENCES staff_members(id),
  source          VARCHAR(20) DEFAULT 'site',
  -- site | sparx_market | b2b_portal
  subject         VARCHAR(255),
  last_message_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id),
  sender_type     VARCHAR(10) NOT NULL, -- customer | tenant | ai
  sender_id       UUID,  -- customer_id or staff_member_id
  body            TEXT NOT NULL,
  attachments     JSONB DEFAULT '[]',
  ai_generated    BOOLEAN DEFAULT false,
  ai_confidence   FLOAT,  -- 0.0 - 1.0, null if human
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_quick_replies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  title           VARCHAR(100) NOT NULL,
  body            TEXT NOT NULL,
  shortcut        VARCHAR(50),  -- /shipping, /returns, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

RLS: `chat_conversations`, `chat_messages`, `chat_quick_replies` — all three get `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` with the standard `tenant_isolation` policy. The `chat_conversations` table is also readable by the customer-auth session (scoped to that customer's `customer_id`) so the site widget can fetch conversation history without going through the tenant's API key.

---

## 7. Widget Configuration

Tenants configure the widget from dashboard Settings → Chat:

```typescript
interface ChatWidgetConfig {
  enabled: boolean;
  position: 'bottom-right' | 'bottom-left';
  primaryColor: string; // defaults to tenant's brand color
  greeting: string; // "Hi! How can we help?"
  awayMessage: string; // shown when tenant is offline
  operatingHours: OperatingHours | null; // null = always on
  aiEnabled: boolean; // default true
  aiPersonaName: string; // "sparx Assistant" or custom
  collectEmail: boolean; // ask before starting chat if anonymous
  showOnPages: 'all' | 'product' | 'cart' | string[];
}
```

Widget configuration is stored in `Tenant.settings.chat` (JSONB column on `tenants`, same pattern as other module settings).

---

## 8. API Endpoints

```
POST   /v1/chat/conversations              Start new conversation
GET    /v1/chat/conversations              List tenant's conversations (inbox)
GET    /v1/chat/conversations/:id          Get conversation + messages
POST   /v1/chat/conversations/:id/messages Send message
PATCH  /v1/chat/conversations/:id          Assign, resolve, spam

GET    /v1/chat/conversations/:id/context  Customer context (orders, history)

POST   /v1/chat/quick-replies             Create quick reply
GET    /v1/chat/quick-replies             List quick replies
DELETE /v1/chat/quick-replies/:id         Delete quick reply

WebSocket: /ws/chat/:conversationId       Real-time message stream
```

Public (no API key, customer-scoped):

```
POST   /v1/public/chat/conversations       Start conversation from site
POST   /v1/public/chat/conversations/:id/messages  Customer sends message
```

---

## 9. Dashboard Inbox UI

Layout: two-panel (conversation list left, thread right). Matches the standard dashboard working-area archetype — list view left, detail view right. Responsive: stacks to single column on mobile (list first, tap to open thread).

```
Chat Inbox
  [All]  [Open (12)]  [Assigned to me (3)]  [Resolved]

  ┌─────────────────────────────────────────────────────┐
  │ Ranchero Trucking · 2 min ago           OPEN        │
  │ "Do you have the 6.7L injector set in stock?"       │
  ├─────────────────────────────────────────────────────┤
  │ Marisa Webb · 14 min ago               ASSIGNED     │
  │ "My order #4820 hasn't shipped yet"                 │
  ├─────────────────────────────────────────────────────┤
  │ Anonymous · 1 hr ago                    OPEN        │
  │ "What's the return policy on filters?"              │
  └─────────────────────────────────────────────────────┘

Right panel (conversation selected):
  Customer: Ranchero Trucking Co.
  Orders: 12 lifetime · $48,200 LTV
  Last order: #4818 · 3 days ago · Paid

  [Messages thread]

  Quick replies: /shipping /returns /hours [+]
  [Type a message...] [Send]
```

### Typing indicators

Both sides see a typing indicator (three-dot animation) while the other party is composing. Transmitted over WebSocket as a `typing` event, debounced 1 s after last keystroke. AI responses show a "sparx AI is thinking..." indicator during inference.

### Read receipts

A message is marked `read_at = NOW()` when the recipient's browser receives it over the WebSocket connection. Read receipts visible to the sender as a small checkmark.

---

## 10. Site Widget

The `@sparx/chat-widget` package exports a single React component:

```tsx
<ChatWidget tenantId={tenant.id} config={chatConfig} customer={currentCustomer} />
```

- Rendered client-side only (`'use client'`)
- Hydrated via `@sparx/customer-auth` session cookie for identification
- Opens as a floating panel over the page (not an iframe — same domain)
- Pre-chat form: if `collectEmail: true` and visitor is anonymous, asks for name + email before connecting
- Conversation history: if returning visitor (matched by email or customer session), shows last conversation

---

## 11. AI Handler

The AI handler runs server-side inside the API, not as a separate worker. On `POST /v1/public/chat/conversations/:id/messages`:

1. Fetch conversation context (last 10 messages)
2. Fetch tenant's product/policy context from Typesense (product fitment, shipping policy, return policy)
3. Call Anthropic API with system prompt + context + user message
4. If `confidence >= 0.8` (extracted from structured output): insert AI message, push over WebSocket
5. If `confidence < 0.8`: insert a handoff message ("Let me connect you with the team"), set `conversation.status = 'open'`, notify tenant

AI system prompt structure:

```
You are {aiPersonaName} for {tenantName}.
Answer questions about products, orders, and policies only.
Return JSON: { "answer": string, "confidence": float, "escalate": boolean }
Only answer what you can confirm from the provided context.
```

Anthropic model: `claude-haiku-4-5` (fast, low cost per message, adequate for Q&A).

---

## 12. Notifications

**Tenant (dashboard):**

- Real-time: WebSocket push to dashboard (already open)
- Push notifications: Web Push API (`/settings/notifications` to subscribe) — tenant gets a browser notification when a new conversation arrives and they're not on the inbox page
- Email fallback: if no WebSocket connection for > 5 minutes, publish `chat.message.received` to Pub/Sub → email-worker sends a "New chat message from {customer}" email

**Customer (widget):**

- Real-time: WebSocket (already in widget)
- No push/email for customer in Phase 1 (can add later)

---

## 13. Operating Hours

If `operatingHours` is configured:

- Outside hours: widget shows away message instead of live chat input
- Customer can still leave a message (stored as a `status: open` conversation for follow-up)
- Optionally: collect email for reply

Inside hours: normal chat. The operating hours check runs client-side (widget) and server-side (AI handler skips escalation if outside hours — sends the away message instead).

---

## 14. sparx.market Integration

Product pages on sparx.market show a "Chat with [Tenant Name]" button when the tenant has chat enabled. Clicking opens an inline chat panel (same `@sparx/chat-widget`, configured with `source: 'sparx_market'`).

If the shopper has a sparx account (signed in to sparx.market), their identity is passed to the widget automatically. If anonymous, `collectEmail: true` is forced.

Conversations from sparx.market appear in the tenant's inbox with source badge "sparx.market".

---

## 15. Billing Module Registration

| Field                | Value                 |
| -------------------- | --------------------- |
| `module_key`         | `chat`                |
| Monthly price        | $19/mo                |
| Annual price         | $182/yr               |
| Standalone           | No (requires Builder) |
| Billing product name | "sparx Chat"          |

Add to `PRICE_CATALOG` in `packages/billing/src/price-catalog.ts` and create the Stripe product/prices during the billing Phase 1 work (docs/67).

---

## 16. Implementation Checklist

- [ ] Module flag: `chat` in `Tenant.settings.modules`
- [ ] DB migration: `chat_conversations`, `chat_messages`, `chat_quick_replies` + RLS policies
- [ ] WebSocket server on API (`/ws/chat/:conversationId`) — socket.io
- [ ] Redis pub/sub for routing messages to the correct tenant's open WebSocket connection
- [ ] Public API endpoints (`/v1/public/chat/*`) — customer-auth scoped
- [ ] Private API endpoints (`/v1/chat/*`) — tenant API key scoped
- [ ] AI handler — Anthropic Haiku integration with Typesense product context
- [ ] `@sparx/chat-widget` package: floating bubble, message thread, pre-chat form
- [ ] Site integration: widget injected in site layout when module active
- [ ] Widget configuration UI (Settings → Chat) — follows settings page archetype
- [ ] Dashboard inbox UI — two-panel, conversation list + thread view
- [ ] Customer context sidebar (orders, LTV, history from CRM)
- [ ] Quick replies system with `/shortcut` autocomplete
- [ ] Typing indicators over WebSocket
- [ ] Read receipts
- [ ] Web Push notifications for tenant (new conversation, offline)
- [ ] Email notification fallback (Pub/Sub → email-worker)
- [ ] Operating hours logic — away message outside hours
- [ ] sparx.market chat integration
- [ ] Conversation assignment to staff members
- [ ] Billing: add `chat` module to price catalog (coordinates with docs/67)
