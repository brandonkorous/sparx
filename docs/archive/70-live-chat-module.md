# Sparx Platform — Live Chat Module Spec

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-05-31

---

## 1. Overview

Sparx Live Chat is a built-in customer communication module. Merchants get a branded chat widget on their site and a unified inbox in the dashboard — no Intercom, no Zendesk, no Crisp required. The AI layer handles common questions instantly; humans handle the rest.

**Module:** Chat · +$19/mo  
**Surfaces:** Site widget, merchant dashboard inbox, sparx.market product pages

---

## 2. Why Build It

Every Sparx merchant currently solves customer support themselves. Options are:

- Ignore it (bad for conversion)
- Pay Intercom/Zendesk ($100–300/mo)
- Cobble together Facebook Messenger

A native chat widget that works out of the box — on their sparx.zone site and custom domain — is a retention feature. For sparx.market specifically, chat is essential: a shopper looking at a diesel injector has questions. A "Chat with Gillett Diesel" button is the difference between a bounce and a sale.

---

## 3. Three Surfaces

### Surface 1 — Site Widget

Floating chat bubble on merchant's site (sparx.zone or custom domain). Shopper opens conversation → merchant responds from dashboard inbox. Conversation history saved in CRM.

### Surface 2 — Merchant Dashboard Inbox

All customer conversations in one place. Assign to staff members. See customer's order history in sidebar. Quick replies, saved responses. Mobile push notifications.

### Surface 3 — sparx.market Chat

"Chat with [Merchant Name]" on product pages. Routes to that merchant's inbox. Shopper identified if they have a Sparx account.

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
  → Merchant notified via push/email
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

No third-party service required. Everything in existing stack:

```
WebSockets        — real-time message delivery
                    socket.io on the API server

PostgreSQL        — conversation and message storage
                    already in stack, no new service

Redis pub/sub     — route messages to correct merchant dashboard
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
  sender_type     VARCHAR(10) NOT NULL, -- customer | merchant | ai
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

---

## 7. Widget Configuration

Merchants configure the widget from dashboard Settings → Chat:

```typescript
interface ChatWidgetConfig {
  enabled: boolean;
  position: 'bottom-right' | 'bottom-left';
  primaryColor: string; // defaults to merchant's brand color
  greeting: string; // "Hi! How can we help?"
  awayMessage: string; // shown when merchant is offline
  operatingHours: OperatingHours | null; // null = always on
  aiEnabled: boolean; // default true
  aiPersonaName: string; // "Sparx Assistant" or custom
  collectEmail: boolean; // ask before starting chat if anonymous
  showOnPages: 'all' | 'product' | 'cart' | string[];
}
```

---

## 8. API Endpoints

```
POST   /v1/chat/conversations              Start new conversation
GET    /v1/chat/conversations              List merchant's conversations
GET    /v1/chat/conversations/:id          Get conversation + messages
POST   /v1/chat/conversations/:id/messages Send message
PATCH  /v1/chat/conversations/:id          Assign, resolve, spam
GET    /v1/chat/conversations/:id/context  Customer context (orders, history)

POST   /v1/chat/quick-replies             Create quick reply
GET    /v1/chat/quick-replies             List quick replies
DELETE /v1/chat/quick-replies/:id         Delete quick reply

WebSocket: /ws/chat/:conversationId       Real-time message stream
```

---

## 9. Dashboard Inbox UI

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

---

## 10. Pricing

**+$19/mo** — included in Chat module activation.

- Unlimited conversations
- AI-assisted responses (reads product/fitment data)
- Mobile push notifications for merchant
- Full conversation history saved in CRM
- sparx.market chat integration included
- Custom widget colors (matches merchant brand)
- Quick replies and saved responses
- Operating hours configuration

---

## 11. Implementation Checklist

- [ ] Add chat module to tenant feature flags
- [ ] DB schema — conversations + messages + quick_replies
- [ ] WebSocket server on API (socket.io)
- [ ] Redis pub/sub for message routing to merchant dashboard
- [ ] AI handler — Claude Haiku integration with product context
- [ ] Site widget component (@sparx/chat-widget)
- [ ] Widget configuration UI (Settings → Chat)
- [ ] Dashboard inbox UI (conversation list + thread view)
- [ ] Customer context sidebar (orders, LTV, history)
- [ ] Quick replies system with /shortcut syntax
- [ ] Mobile push notifications (merchant)
- [ ] Email notification fallback (merchant offline)
- [ ] sparx.market chat routing
- [ ] Operating hours logic (away message)
- [ ] Conversation assignment to staff members
- [ ] Read receipts
- [ ] Typing indicators
- [ ] File/image attachment support
      EOF
