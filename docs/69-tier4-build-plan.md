# sparx Platform — Tier 4 Build Plan

**Version:** 1.1
**Author:** Brandon Korous
**Last Updated:** 2026-06-17

---

## Overview

Tier 4 covers two parallel tracks that ship together to close the gap between "working platform" and "polished product":

**Track A — Live Chat module** ([docs/56](56-live-chat-module.md)): a new first-party customer communication module — site widget, AI-first responses, tenant inbox. New module, new package, new WebSocket surface.

**Track B — Wizards, Import/Export & Bulk Ops** ([docs/68](68-wizards-import-export-bulk.md)): UX-layer improvements across all existing list views — multi-step creation wizards for complex entities, CSV import/export, and a fleet-level bulk action bar.

Tracks A and B are independent. They can be built in either order or in parallel. The recommended sequencing below runs them in series to keep the branch count manageable.

**Build constraints (CLAUDE.md):** production-complete, module-gated via `requireModule`, event-driven, RLS on all tenant tables, conventional commits, no Co-Authored-By.

---

## Track A — Live Chat Module

**Spec:** [docs/56-live-chat-module.md](56-live-chat-module.md)

### Phase A-1 — DB schema + API foundation

**Goal:** data layer and REST endpoints in place; no UI yet.

**DB migration** (`wizeworks/packages/db/prisma/migrations/`):

```sql
CREATE TABLE chat_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'open',
  assigned_to     UUID REFERENCES staff_members(id),
  source          VARCHAR(20) NOT NULL DEFAULT 'site',
  subject         VARCHAR(255),
  last_message_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON chat_conversations
  USING (tenant_id = current_setting('sparx.tenant_id')::uuid);

CREATE TABLE chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_type     VARCHAR(10) NOT NULL, -- customer | staff | ai
  sender_id       UUID,
  body            TEXT NOT NULL,
  attachments     JSONB NOT NULL DEFAULT '[]',
  ai_generated    BOOLEAN NOT NULL DEFAULT false,
  ai_confidence   FLOAT,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages FORCE ROW LEVEL SECURITY;
-- Inherit tenant through conversation
CREATE POLICY tenant_isolation ON chat_messages
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations c
      WHERE c.id = conversation_id
        AND c.tenant_id = current_setting('sparx.tenant_id')::uuid
    )
  );

CREATE TABLE chat_quick_replies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           VARCHAR(100) NOT NULL,
  body            TEXT NOT NULL,
  shortcut        VARCHAR(50),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE chat_quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_quick_replies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON chat_quick_replies
  USING (tenant_id = current_setting('sparx.tenant_id')::uuid);

CREATE INDEX idx_chat_conversations_tenant_status
  ON chat_conversations(tenant_id, status);
CREATE INDEX idx_chat_messages_conversation
  ON chat_messages(conversation_id, created_at);
```

**Prisma schema additions** (`wizeworks/packages/db/prisma/schema.prisma`): add `ChatConversation`, `ChatMessage`, `ChatQuickReply` models with the `@map`/`@@map` conventions matching the project.

**Module flag**: add `chat` to the `ModuleKey` union in `wizeworks/packages/db/src/types/module.ts` and to the default `settings.modules` shape in the tenant seed/onboarding flow.

**REST endpoints** (`apps/api-rest/src/routes/chat/`):

```
GET    /v1/chat/conversations              — list with status filter, pagination
POST   /v1/chat/conversations              — create (staff-initiated)
GET    /v1/chat/conversations/:id          — conversation + paginated messages
POST   /v1/chat/conversations/:id/messages — staff sends message
PATCH  /v1/chat/conversations/:id          — assign / resolve / spam

GET    /v1/chat/conversations/:id/context  — CRM customer context
                                             (orders, LTV, recent activity)

GET    /v1/chat/quick-replies
POST   /v1/chat/quick-replies
DELETE /v1/chat/quick-replies/:id

POST   /v1/public/chat/conversations       — public: start conversation
POST   /v1/public/chat/conversations/:id/messages  — public: customer message
```

All `/v1/chat/*` routes gated by `requireModule('chat')`. Public routes are on the existing public router (no API key required, rate-limited by IP + tenant).

**Vitest integration tests**: `apps/api-rest/src/__tests__/chat/` — cover conversation lifecycle (open → assign → resolve), message CRUD, module guard (returns 404 when chat disabled).

---

### Phase A-2 — WebSocket server + Redis routing

**Goal:** real-time message delivery between site widget and dashboard inbox.

**socket.io setup** in `apps/api-rest/src/websocket/`:

- `chat-namespace.ts` — `/ws/chat` namespace; authenticate via `sparx_session` cookie (customer) or `Authorization: Bearer` (staff API key)
- On connect: join room `conversation:{conversationId}`; verify tenant ownership
- On `message` event: persist to DB (re-use Phase A-1 endpoint logic), broadcast to room
- On `typing` event: broadcast typing indicator to room (no DB write); debounced 1 s
- On `read` event: update `chat_messages.read_at` for all unread messages by the reader

**Redis pub/sub** (`packages/redis/src/chat.ts`):

- Channel pattern: `chat:tenant:{tenantId}:new` — published when a new inbound message arrives on any conversation for that tenant
- The dashboard WebSocket connection subscribes to this channel to drive the "unread badge" in the sidebar nav

**Types**: add `ChatSocketEvents` to `wizeworks/packages/events/src/chat.ts` (typed socket event map, reused by widget and dashboard).

---

### Phase A-3 — AI handler

**Goal:** AI auto-responds to site messages; escalates when not confident.

Location: `apps/api-rest/src/services/chat-ai.ts`

On `POST /v1/public/chat/conversations/:id/messages` after the customer message is persisted:

1. Check `chatConfig.aiEnabled` (skip if false)
2. Check operating hours (skip if outside hours — send away message instead)
3. Fetch last 10 messages for context
4. Fetch product/policy context from Typesense (`/indexes/entities` scoped to `tenant_id`, `type: 'product'|'page'`)
5. Call Anthropic API — model `claude-haiku-4-5-20251001`:

```typescript
const response = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 512,
  system: buildChatSystemPrompt(tenant, chatConfig),
  messages: [...conversationHistory, { role: 'user', content: customerMessage }],
  tools: [{ name: 'respond', input_schema: { ...answer, confidence, escalate } }],
  tool_choice: { type: 'tool', name: 'respond' },
});
```

6. If `confidence >= 0.8` and `escalate === false`: insert AI message, broadcast over WebSocket
7. If `confidence < 0.8` or `escalate === true`: insert handoff message, set `conversation.status = 'open'`, publish `chat.message.received` to Pub/Sub (triggers notification)

**Pub/Sub event**: `chat.message.received` — consumed by email-worker when no active WebSocket connection for tenant (see Phase A-5).

---

### Phase A-4 — `@wizeworks/chat-widget` package + site integration

**Goal:** floating chat bubble on every site page when module is active.

New package: `wizeworks/packages/chat-widget/` with the standard package scaffold (`package.json`, `tsconfig.json`, `src/index.ts`).

```tsx
// wizeworks/packages/chat-widget/src/ChatWidget.tsx
'use client';

export function ChatWidget({ tenantId, config, customer }: ChatWidgetProps) {
  // state: open/closed, messages, typing, connection
  // socket.io connection to /ws/chat
  // pre-chat form if config.collectEmail && !customer
  // floating bubble + slide-up panel
}
```

Widget is injected into the tenant site layout (`wizeworks/apps/site/src/app/layout.tsx`) when `tenant.settings.modules.chat?.enabled`:

```tsx
{
  chatConfig?.enabled && (
    <ChatWidget tenantId={tenant.id} config={chatConfig} customer={currentCustomer} />
  );
}
```

Widget follows `@sparx/site-ui` design tokens for colors (uses `--st-accent` for the bubble, overridden by `config.primaryColor`). No custom CSS-in-JS — Tailwind utility classes only.

**Widget states:**

- Closed: floating bubble (bottom-right or bottom-left per config)
- Open: slide-up panel (320px wide, full-height on mobile) with message thread
- Pre-chat: name/email form before first message (if `collectEmail: true` and anonymous)
- Away: shows `config.awayMessage` instead of input (outside operating hours)

---

### Phase A-5 — Dashboard inbox UI

**Goal:** tenant staff can receive and respond to conversations from the dashboard.

Route: `apps/app/src/app/(dashboard)/chat/` — chat module gated by `<ModuleGate module="chat">`.

**Pages:**

- `page.tsx` — inbox landing; redirects to first open conversation or empty state
- `(inbox)/layout.tsx` — two-panel layout (conversation list left, thread right)
- `(inbox)/[conversationId]/page.tsx` — thread view

**Components** (`_components/`):

- `ConversationList` — scrollable list with status tabs (All / Open / Mine / Resolved), real-time unread badge, WebSocket-updated
- `ConversationRow` — customer name, snippet, timestamp, status badge, unread indicator
- `ThreadView` — message bubbles (customer / staff / AI), typing indicator, message input
- `CustomerContextSidebar` — CRM data: name, email, lifetime orders, LTV, last order; shown in a collapsible right panel
- `QuickReplyPicker` — `/` triggered autocomplete list in the message input

**WebSocket in dashboard**: `useChat(conversationId)` hook in `_hooks/use-chat.ts` — manages socket.io connection, optimistic message sends, typing events.

**Settings page**: `apps/app/src/app/(dashboard)/settings/chat/page.tsx` — widget configuration form (`ChatWidgetConfig` fields), quick replies management, operating hours. Follows the standard Settings page archetype.

---

### Phase A-6 — Notifications + sparx.market integration

**Goal:** tenant gets notified even when not in the dashboard.

**Web Push** (`apps/app/src/app/(dashboard)/settings/notifications/`):

- "Enable desktop notifications" toggle in notification settings
- `POST /v1/notifications/push/subscribe` stores `PushSubscription` in `push_subscriptions` table (new small table, RLS)
- On `chat.message.received` Pub/Sub event: send Web Push notification if subscription exists and tenant not currently active on WebSocket

**Email fallback** (email-worker):

- `chat.message.received` Pub/Sub consumer in `services/email-worker/src/handlers/chat.ts`
- Sends "New chat message from {customerName}" email using `ChatNotificationTemplate` in `wizeworks/packages/email/src/templates/`
- Guard: only send if no Web Push subscription OR push failed (fallback, not duplicate)

**sparx.market** (`sparx/apps/web/src/app/(market)/products/[slug]/`):

- Import `ChatWidget` from `@wizeworks/chat-widget`
- Show "Chat with {tenantName}" CTA on product pages when the selling tenant has chat enabled
- Source parameter: `source: 'sparx_market'`

---

## Track B — Wizards, Import/Export & Bulk Ops

**Spec:** [docs/68-wizards-import-export-bulk.md](68-wizards-import-export-bulk.md)

### Phase B-1 — Product wizard

**Goal:** replace the "New Product" flat overlay with a 4-step wizard.

The existing `EntityCreateButton` on the products list view opens a detail view with `type: 'new'`. Replace the blank detail view with the wizard.

**File:** `apps/app/src/app/(dashboard)/commerce/products/_components/product-wizard.tsx`

Steps:

1. **Basics** — Name (required), SKU (required, uniqueness check), Product type (`Physical` / `Digital` / `Service`)
2. **Pricing** — Price, Compare-at price, Tax class
3. **Inventory** (Physical only) — Track inventory toggle, Quantity, Low stock threshold, Weight + dimensions
4. **Review** — Summary card, "Create product" button → single `POST /v1/products`

Uses the existing `<Stepper>` component from `@wizeworks/ui`. All state lifted to the wizard parent; no network writes until Step 4 submit.

Step files: `_components/product-wizard/step-basics.tsx`, `step-pricing.tsx`, `step-inventory.tsx`, `step-review.tsx`.

---

### Phase B-2 — Import/Export for Products + Customers

**Goal:** CSV in/out on both the Products list and CRM Customers list.

**New Cloud Run worker**: `wizeworks/services/import-worker/` — follows the `cloud-run-worker` Terraform module pattern (same as email-worker). Subscribes to `import.job.created` Pub/Sub topic.

Worker processes:

1. Download CSV from signed GCS URL
2. Parse + validate rows (Papa Parse)
3. Upsert records by natural key (SKU for products, email for customers)
4. Write row-level results to `import_job_results` table (new table, RLS)
5. Publish `import.job.completed`

**New tables:**

```sql
CREATE TABLE import_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type  VARCHAR(50) NOT NULL, -- products | customers | b2b_accounts | ...
  status       VARCHAR(20) NOT NULL DEFAULT 'queued',
  -- queued | processing | completed | failed
  file_gcs_url TEXT NOT NULL,
  total_rows   INTEGER,
  success_rows INTEGER,
  error_rows   INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
-- RLS: ENABLE + FORCE tenant_isolation

CREATE TABLE import_job_rows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  row_number  INTEGER NOT NULL,
  status      VARCHAR(20) NOT NULL, -- success | error | skipped
  error_code  VARCHAR(100),
  error_detail TEXT,
  input_data  JSONB NOT NULL
);
-- RLS: inherits through job (same pattern as chat_messages)
```

**API:**

```
POST   /v1/import/jobs          — create job (upload CSV → GCS → publish event)
GET    /v1/import/jobs          — list recent jobs
GET    /v1/import/jobs/:id      — job status + row summary
GET    /v1/import/jobs/:id/rows — paginated row results (filterable by status=error)
GET    /v1/import/jobs/:id/error-report  — download failed rows as CSV

GET    /v1/export/products      — synchronous CSV <5k rows; async + email >5k
GET    /v1/export/customers     — same
```

**UI components** (`sparx/packages/ui/src/components/data/`):

- `ImportDialog` — 5-step dialog: Upload → Preview → Column mapping → Confirm → Progress/results
- `ExportButton` — dropdown: "Export all" / "Export filtered" / "Export selected"

Wire into Products list (`apps/app/src/app/(dashboard)/commerce/products/`) and Customers list (`apps/app/src/app/(dashboard)/crm/customers/`).

---

### Phase B-3 — Bulk action bar

**Goal:** slide-up bulk action bar on all entity list views.

**New component**: `sparx/packages/ui/src/components/data/BulkActionBar.tsx`

```tsx
<BulkActionBar
  selected={selectedIds}
  onClear={() => setSelected([])}
  actions={bulkActions} // BulkAction[]
/>
```

Renders fixed-position at the bottom of the viewport, above any footer, when `selected.length > 0`. Slides in with a CSS transition. Includes selection count + "Clear" button.

`BulkAction` type:

```typescript
type BulkAction = {
  label: string;
  icon?: React.ComponentType;
  variant?: 'default' | 'destructive';
  requiresConfirm?: boolean;
  confirmLabel?: string; // "Delete {count} products"
  onAction: (ids: string[]) => Promise<void>;
};
```

**Destructive actions** use `useConfirm` — confirmation dialog must name the target count and state data loss (e.g., "Delete 12 products? This cannot be undone.").

**Per-entity action sets** — implement for each list view:

| Entity          | Bulk actions                               |
| --------------- | ------------------------------------------ |
| Products        | Set status (Active/Draft/Archived), Delete |
| Collections     | Delete                                     |
| Customers       | Add tag, Remove tag, Delete                |
| B2B Accounts    | Set status, Assign rep, Delete             |
| Orders          | Fulfill, Archive, Export                   |
| CMS Entries     | Set status (Published/Draft), Delete       |
| Email campaigns | Archive, Delete                            |

**Bulk price adjustment** (Products only): requires dry-run preview table (before → after per product) displayed in a modal before applying. 30-minute revert window — store the before-values in `bulk_op_reverts` table for the undo window.

Wire `BulkActionBar` into each list view's selection state.

---

### Phase B-4 — CMS Content wizard + SchemaFieldRenderer

**Goal:** guided creation flow for CMS content entries.

**New shared component**: `sparx/packages/ui/src/components/form/SchemaFieldRenderer.tsx` — maps content type schema field types to `@wizeworks/ui` inputs:

| Schema field type | Component                               |
| ----------------- | --------------------------------------- |
| `text`            | `<Input>`                               |
| `textarea`        | `<Textarea>`                            |
| `richtext`        | `<RichTextEditor>` (simplified toolbar) |
| `number`          | `<Input type="number">`                 |
| `boolean`         | `<Switch>`                              |
| `select`          | `<Select>`                              |
| `multiselect`     | `<MultiSelect>`                         |
| `date`            | `<DatePicker>`                          |
| `reference`       | `<RecordPicker>`                        |
| `media`           | always skipped in wizard context        |

`SchemaFieldRenderer` is the canonical mapping. It is imported by the CMS wizard and any future schema-driven form context.

**CMS wizard**: `apps/app/src/app/(dashboard)/cms/_components/content-wizard.tsx`

Steps:

1. **Type** — grid of content type cards (icon, name, routable/non-routable badge). Skipped if entering from a type-specific context (e.g., `/cms/posts/new`).
2. **Required fields** — only `required: true` schema fields rendered via `SchemaFieldRenderer`. `title` is always required. Media fields deferred. Step skipped if type has zero required non-media fields.
3. **Publish settings** — Title (de-duplicated), Slug (routable types only; auto-generated from title; uniqueness check via `GET /v1/content/types/{typeKey}/check-slug?slug={slug}`), Template selector (routable only; hidden if zero linked templates; pre-selected + collapsed if exactly one), Status (Draft/Published), Publish date (only when Published selected).

Empty state for Step 1: "No content types defined yet. Create one first." with a link to the content type manager.

Guard: CMS wizard gated by `requireModule('cms')`.

---

### Phase B-5 — B2B Account + Customer full-profile wizards

**Goal:** wizard creation flows for the two remaining complex entities.

**B2B Account wizard** (`apps/app/src/app/(dashboard)/b2b/accounts/_components/b2b-account-wizard.tsx`):

Steps:

1. **Company** — Company name, Industry, Website URL, Billing address
2. **Primary contact** — First name, Last name, Email, Phone. Email deduplication check: `GET /v1/crm/customers?email=X` — if match found, shows "This contact exists in CRM — link them?" confirmation instead of creating duplicate
3. **Account terms** — Payment terms (Net 15/30/45/60), Credit limit, Pricing tier (select from existing tiers)
4. **Review** — Summary + create

Gated by `requireModule('b2b')`.

**Customer wizard** (`apps/app/src/app/(dashboard)/crm/customers/_components/customer-wizard.tsx`):

Entry point has a dropdown split: "Quick add" / "Full profile"

- **Quick add**: single-step — First name, Last name, Email → `POST /v1/crm/customers`. Inline in a narrow overlay.
- **Full profile wizard** (3 steps):
  1. **Identity** — Name, Email, Phone, Company (optional), Tags
  2. **Address** — Billing address, Shipping address (or "same as billing")
  3. **Notes** — Internal notes, Source (manual/import/site/b2b), "Create customer" button

---

### Phase B-6 — Remaining entities + Excel import

**Goal:** close out import/export for remaining entity types and add Excel-on-upload support.

**Import/Export additions:**

- B2B Accounts import (upsert by `company_name + domain`)
- Discount Codes import (upsert by `code`)
- Excel (`.xlsx`) accepted on upload: convert to CSV server-side using `exceljs` before passing to import-worker

**Remaining entity wire-up:**

- Collections list: bulk action bar
- Orders list: bulk fulfill + export
- Email campaigns list: bulk archive + delete

---

## Build order summary

| Phase | Track   | Description                              | Dependencies                      |
| ----- | ------- | ---------------------------------------- | --------------------------------- |
| A-1   | Chat    | DB schema + REST API                     | None                              |
| A-2   | Chat    | WebSocket + Redis routing                | A-1                               |
| A-3   | Chat    | AI handler                               | A-1, A-2                          |
| A-4   | Chat    | `@wizeworks/chat-widget` + site          | A-1, A-2                          |
| A-5   | Chat    | Dashboard inbox UI                       | A-1, A-2, A-3                     |
| A-6   | Chat    | Notifications + sparx.market             | A-5                               |
| B-1   | Wizards | Product wizard                           | None                              |
| B-2   | Import  | Product + Customer import/export         | None (new Cloud Run worker)       |
| B-3   | Bulk    | BulkActionBar component + all entities   | None                              |
| B-4   | Wizards | CMS content wizard + SchemaFieldRenderer | B-1 (establishes stepper pattern) |
| B-5   | Wizards | B2B Account + Customer wizards           | B-1, B-4                          |
| B-6   | Import  | Remaining entities + Excel               | B-2                               |

Tracks A and B have no dependencies on each other. A-1 through A-6 can run concurrently with B-1 through B-6 if staffed separately.

---

## Pre-launch checklist

**Chat module:**

- [ ] `requireModule('chat')` gates all `/v1/chat/*` routes
- [ ] RLS policies on all three chat tables
- [ ] WebSocket authentication rejects unauthenticated connections
- [ ] AI handler respects `aiEnabled: false` config
- [ ] Operating hours away-message tested
- [ ] Chat module added to `PRICE_CATALOG` (coordinates with docs/67 Billing)
- [ ] sparx.market integration tested with a real tenant

**Wizards / Import / Bulk:**

- [ ] All destructive bulk actions behind `useConfirm` with count + loss statement
- [ ] Import worker handles malformed CSV gracefully (row-level errors, not job crash)
- [ ] Bulk price adjustment dry-run preview before any write
- [ ] 30-minute revert window stores before-state
- [ ] CMS wizard Step 1 skipped correctly from type-specific context
- [ ] `SchemaFieldRenderer` is the only mapping source — no inline field→component logic elsewhere
- [ ] Import jobs audited to `audit_logs`
