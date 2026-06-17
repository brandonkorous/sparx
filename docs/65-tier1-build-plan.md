# sparx Platform — Tier 1 Build Plan

**Version:** 1.1
**Author:** Brandon Korous
**Last Updated:** 2026-06-17

---

## Overview

Tier 1 covers the three features that make the platform functional end-to-end: a working checkout with payment, a complete onboarding flow, and the MCP/AI module. Without these, the platform cannot take a real order, onboard a real tenant, or deliver its AI differentiation.

All three can be built in parallel by separate agents. Dependencies are noted per phase.

**Build constraints (CLAUDE.md):** production-complete, event-driven side effects, module-gated, RLS on all tenant tables, conventional commits, no Co-Authored-By.

---

## Feature 1 — Checkout & Payment Processing (docs/09)

**Spec:** [docs/09-ecommerce-engine-prd.md](09-ecommerce-engine-prd.md)
**Existing foundation:** Products, variants, collections, cart (persistent + guest merge), abandonment tracking, checkout sessions model, orders list stub. Missing: Stripe PaymentIntent flow, shipping calculation, tax, order confirmation, fulfillment tracking.
**Module flag:** `commerce`

### Phase 1 — Stripe integration foundation

Install `stripe` SDK in `services/api-rest/`. Add to Secret Manager and `.env.example`: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.

Create `services/api-rest/src/lib/stripe.ts`:

- Stripe client singleton (reads key from env)
- `createPaymentIntent(params)` — creates PaymentIntent with `automatic_payment_methods: { enabled: true }`
- `confirmPaymentIntent(id)` — confirm + capture
- `createRefund(paymentIntentId, amountCents?)` — full or partial
- `constructWebhookEvent(body, sig)` — webhook signature verification

Pub/Sub events to add in `@sparx/events`: `order.created`, `order.fulfilled`, `order.refunded`, `payment.captured`, `payment.failed`.

### Phase 2 — Checkout API

New route file `services/api-rest/src/routes/v1/checkout.ts` (or extend existing checkout-sessions):

| Method  | Path                                       | Description                                                                              |
| ------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `POST`  | `/v1/checkout/sessions`                    | Create session from cart — validates inventory, calculates totals, creates PaymentIntent |
| `GET`   | `/v1/checkout/sessions/:id`                | Current session state (items, totals, payment intent client secret)                      |
| `PATCH` | `/v1/checkout/sessions/:id`                | Update shipping address / method / contact info                                          |
| `POST`  | `/v1/checkout/sessions/:id/shipping-rates` | Calculate available shipping rates for current address                                   |
| `POST`  | `/v1/checkout/sessions/:id/complete`       | Confirm PaymentIntent → create Order → decrement inventory atomically                    |

Checkout session creates a `PaymentIntent` and returns `client_secret` to the site for Stripe.js to handle 3D Secure, Apple Pay, Google Pay, and Link. The session stores `stripe_payment_intent_id`; completion is idempotent (re-presenting confirmed intent returns the existing order).

Order creation (atomic, in a Postgres transaction):

1. Verify all inventory still available (re-check, don't trust session snapshot)
2. Decrement `product_variants.inventory_quantity` for each line
3. Insert `orders` row + `order_lines` rows
4. Insert `order_fulfillments` placeholder (status: `unfulfilled`)
5. Clear cart
6. Publish `order.created` to Pub/Sub

### Phase 3 — Shipping

Flat rate shipping for Phase 1 (covers 95% of tenants out of the box):

New `shipping_zones` + `shipping_rates` tables (RLS ENABLE + FORCE):

- `shipping_zones`: id, tenant_id, name, countries TEXT[], regions TEXT[]
- `shipping_rates`: id, tenant_id, zone_id, name, type (flat/free/weight/price), value_cents, min_weight, max_weight, min_order_cents, is_active

`POST /v1/checkout/sessions/:id/shipping-rates` returns matching rates for the delivery address. Tenant configures zones + rates in Settings → Shipping.

EasyPost (carrier-calculated) is Phase 2 — not needed for initial launch.

Local pickup: a `pickup_locations` table + an option on the shipping-rates endpoint returning `type: pickup` rows.

### Phase 4 — Tax

Phase 1: simple manual tax rate per region (covers the majority of tenants for launch).

New `tax_settings` table (1:1 per tenant): `tax_included` bool, `default_rate` numeric(5,2), `regions` JSONB (array of `{ country, region, rate }`). Tax-exempt `customer_ids` JSONB array.

Tax calculation at checkout: look up region of delivery address in the tenant's `tax_settings`. Return `tax_total_cents` on the session.

TaxJar / Avalara integration is Phase 2 — deferred until a tenant explicitly needs automated multi-jurisdiction compliance.

### Phase 5 — Orders dashboard + fulfillment

`apps/app/src/app/(dashboard)/commerce/orders/` — full orders list + detail view:

- Orders list: ListToolbar with status / date / fulfillment filters, search
- Order detail: timeline, line items, payment status, fulfillment panel, refund panel
- Fulfillment: "Create fulfillment" (enter tracking number + carrier) → publishes `order.fulfilled` → email-worker sends shipping confirmation
- Refund: full or partial, back to original payment method via Stripe, inventory restock toggle

API:

- `GET /v1/orders` — list with filters
- `GET /v1/orders/:id` — full detail
- `POST /v1/orders/:id/fulfillments` — create fulfillment
- `POST /v1/orders/:id/refunds` — initiate refund

### Phase 6 — Site checkout UI

`apps/site/app/checkout/` — multi-step React form:

1. Cart review (items, subtotal, discount code input)
2. Customer info (email, name — pre-populated if logged in)
3. Shipping (address form, rate selector)
4. Payment (Stripe Elements — card + Apple Pay / Google Pay)
5. Confirmation (order number, summary, "Continue shopping")

Uses `@stripe/stripe-js` and `@stripe/react-stripe-js`. PaymentIntent client secret from checkout session. Redirect back to confirmation on `payment_intent.succeeded`.

### Phase 7 — Stripe webhooks

`POST /v1/webhooks/stripe` (no auth, signature verification only):

- `payment_intent.succeeded` → mark order paid, publish `payment.captured`
- `payment_intent.payment_failed` → notify merchant, restore inventory reservation
- `charge.refunded` → update order financial status

Webhook endpoint registered in Stripe Dashboard for prod + Stripe CLI for local dev.

### Phase 8 — Discounts at checkout

Extend checkout session: `POST /v1/checkout/sessions/:id/discount` → validate and apply discount code. Removes the code on session completion. Discount types: percentage off, fixed amount, free shipping, buy-X-get-Y (per docs/09 §6). All already have the DB model — this wires them into the checkout price calculation.

---

## Feature 2 — Tenant Onboarding Completion (docs/15)

**Spec:** [docs/15-merchant-onboarding-prd.md](15-merchant-onboarding-prd.md)
**Existing foundation:** 6-step onboarding flow in `apps/app/src/app/(onboarding)/onboarding/` with steps for business, domain, product/dropship, theme, payments, done. Steps 1–3 functional. Step 4 (domain): only shows subdomain — no GoDaddy search/purchase UI (that lands with Tier 2 Domain Purchase). Step 5 (Stripe): OAuth structure present but not wired. Done screen exists.
**Dependency:** Step 4 domain purchase UI depends on Tier 2 Domain Purchase Phase 4 being done first. Step 5 Stripe OAuth depends on Feature 1 Phase 1 (Stripe client).

### Phase 1 — Stripe Connect OAuth (Step 5)

Stripe Connect allows tenants to accept payments through their own Stripe account (marketplace model) or platform account depending on configuration.

For Phase 1, use **Stripe Connect Express** (fastest path to tenant-owns-payments):

1. "Connect Stripe" button in onboarding Step 5 → redirect to Stripe OAuth URL with `scope=read_write&client_id={STRIPE_CLIENT_ID}`
2. Stripe redirects back to `/api/stripe/callback?code=...`
3. Exchange code for `stripe_user_id` via `POST https://connect.stripe.com/oauth/token`
4. Store `stripe_account_id` on the tenant record
5. Redirect to Step 6 (done) with payments enabled indicator

Add `stripe_account_id` to `tenants` table. Subsequent PaymentIntents for this tenant pass `stripeAccount: tenant.stripeAccountId` to Stripe client. **Do not store `access_token`** — Express Connect does not require it after the initial OAuth exchange; the `stripe_account_id` is the only durable identifier needed.

"Skip for now" path: store nothing, mark payments as not connected. Dashboard shows a banner prompting connection. Checkout surfaces a "payments not set up" message.

### Phase 2 — Done screen + post-onboarding state

Done screen (`/onboarding/done`):

- Accurately reflects what was completed: live subdomain ✓ / products # ✓ / payments connected ✓ or ✗
- "Visit Store" → opens `https://{slug}.sparx.zone` in new tab
- "Go to Dashboard" → redirect to `/`

Progressive feature discovery panel: non-blocking tips in the dashboard shell for the first 7 days (per docs/15 §3). Implement as a dismissible `DashboardTip` component reading from a `onboarding_checklist` table that tracks which tips have been shown/dismissed per tenant. No modals, no blocking prompts.

### Phase 3 — Onboarding Step 4 domain integration

**Depends on:** Tier 2 Domain Purchase Phase 4 (dashboard domain search UI).

Update onboarding Step 4 from "show subdomain only" to the full domain search flow: debounced suggestions, pricing, "Purchase & Connect" CTA, and "Use my existing domain" secondary path. Keep "Continue with `{slug}.sparx.zone`" as the zero-friction primary option — domain purchase is the secondary upsell, collapsed by default (per docs/15 §4).

### Phase 4 — Legal acceptance gate on signup

**Depends on:** Tier 2 Legal & Consent slice 6 (or can be built independently ahead of it).

Add the combined acceptance checkbox to the sign-up form: _"I agree to the sparx Terms of Service, Privacy Policy, and Acceptable Use Policy."_ Write `platform_legal_acceptance` rows (terms/privacy/aup) inside the existing `signUpMerchant` transaction (docs/42 §6.3). Zero extra wizard steps — happens on the existing account-creation screen.

---

## Feature 3 — MCP/AI Module (docs/07)

**Spec:** [docs/07-mcp-server-spec.md](07-mcp-server-spec.md)
**Existing foundation:** No implementation. The spec is complete (v1.2). The `ai` module flag exists in the module registry per CLAUDE.md.
**Module flag:** `ai`

### Phase 1 — Service scaffold + auth

New service `services/api-mcp/` as a GKE Deployment (not Cloud Run — it runs persistent SSE connections).

Setup:

- `@modelcontextprotocol/sdk` as the MCP transport layer
- Fastify + SSE transport for Claude (MCP over SSE), HTTP transport for ChatGPT/Copilot (MCP over HTTP)
- Module gate: every request validates the tenant has the `ai` module active. Reject with HTTP 403 if not.
- Per-tool scope checking: read vs. write scopes per docs/07 §5

API key generation: new `mcp_api_keys` table (tenant*id, key_hash, scopes TEXT[], label, last_used_at, created_at — RLS ENABLE + FORCE). Dashboard Settings → AI Integrations generates scoped keys. Keys are `sparx_mcp*{random}` format, hashed with Argon2id at rest.

**Why a dedicated table instead of Better Auth API keys:** CLAUDE.md says to use Better Auth's own API key primitives rather than building parallel systems. MCP keys are justified as a separate system because: (1) they carry per-tool scopes (`orders:read`, `products:write`, etc.) that don't map to Better Auth's org-membership model; (2) they need per-key rate-limit counters and a `last_used_at` audit trail queryable by the tenant; (3) they are presented to external AI clients (Claude, ChatGPT, Copilot) on a different auth path than the dashboard session. If Better Auth ever ships a first-class API key primitive with arbitrary metadata and per-key rate limits, migrate to it then.

Rate limiting: 60 req/min, 5000 req/day, 10 write tool-calls/min per tenant (configurable via `MCP_QUOTA` constant — docs/07 §7).

### Phase 2 — Core read tools (Orders + Customers)

Implement the tools from docs/07 §3. All tools follow the same pattern:

1. Extract `tenantId` from validated API key context
2. Query Prisma with explicit `tenantId` filter (RLS is FORCE on all tables, but still filter explicitly)
3. Return structured JSON as `{ content: [{ type: 'text', text: JSON.stringify(result) }] }`

**Orders tools:**

- `get_orders({ status?, dateRange?, customerId?, limit?, cursor? })`
- `get_order({ orderId })`
- `get_order_stats({ period })`
- `get_top_customers({ period, limit? })`
- `get_unfulfilled_orders()`
- `update_order_status({ orderId, status })` — write scope, confirmation required

**Customer & CRM tools:**

- `get_customers({ q?, limit?, cursor? })`
- `get_customer({ customerId })`
- `get_inactive_customers({ days })`
- `get_b2b_accounts({ status? })`
- `add_crm_note({ customerId, note })` — write scope
- `get_pipeline()`

All write tools include a `dry_run: true` mode that returns what would be changed without executing — the AI client shows this to the user as a confirmation step.

### Phase 3 — Products, inventory, and analytics tools

**Products & Inventory:**

- `get_products({ q?, status?, limit?, cursor? })`
- `get_low_inventory({ threshold? })`
- `get_product_performance({ productId?, period })`
- `update_inventory({ variantId, adjustment, reason })` — write scope

**Analytics:**

- `get_revenue_summary({ period, compareTo? })`
- `get_sales_by_product({ period, limit? })`
- `get_conversion_rate({ period })`

### Phase 4 — Email and dropship tools

**Email:**

- `send_broadcast({ templateId?, subject, body?, segmentId?, customerIds? })` — write scope, confirmation required, publishes `email.send` via Pub/Sub (does NOT call sendTemplate directly)
- `get_email_stats({ period })`
- `get_automations()`

**Dropship** (depends on Tier 2 Dropship Phase 1):

- `get_dropship_suppliers()`
- `sync_supplier({ supplierId })` — triggers catalog sync event
- `get_pending_dropship_orders()`

### Phase 5 — Audit trail + dashboard UI

**Audit trail:** log every MCP tool call to `audit_logs` (already exists) with actor `system/mcp/{client}`, action = tool name, parameters sanitized (no PII in keys), result status.

**Dashboard Settings → AI Integrations:**

- Connection cards: Claude / ChatGPT / Copilot — each shows the MCP server URL + generated key
- "Generate key" flow: label + scope checkboxes → creates key → shows key once (not stored)
- Key management: list active keys, revoke individual keys
- AI interaction history: log of recent tool calls (what tool, when, result) — tenants can audit their own AI usage

### Phase 6 — Kubernetes deployment

`k8s/api-mcp/deployment.yaml` + `service.yaml` + `hpa.yaml` (starts at 1 replica, scales on CPU/memory). Wired into Caddy routing at `mcp.sparx.works`. Secret mounts for `SPARX_DATABASE_URL`, `MCP_QUOTA` env, and any module-specific API key secrets needed for tools.

TF changes: add `api-mcp` to the service image registry in `infra/terraform/`, and add to `bootstrap.yml` image-build list.

---

## Build order summary

| #   | Feature    | Phase                              | Notes                            |
| --- | ---------- | ---------------------------------- | -------------------------------- |
| 1   | Checkout   | Ph1 Stripe foundation              | Unblocked                        |
| 2   | Checkout   | Ph2 Checkout API                   | After Ph1                        |
| 3   | MCP        | Ph1 Service scaffold + auth        | Unblocked (parallel)             |
| 4   | Checkout   | Ph3 Shipping (flat rate)           | After Ph2                        |
| 5   | Checkout   | Ph4 Tax (manual rates)             | After Ph2                        |
| 6   | MCP        | Ph2 Core read tools                | After Ph1                        |
| 7   | Onboarding | Ph1 Stripe Connect OAuth           | After Checkout Ph1               |
| 8   | Checkout   | Ph5 Orders dashboard + fulfillment | After Ph2                        |
| 9   | Checkout   | Ph6 Site checkout UI               | After Ph2–4                      |
| 10  | Checkout   | Ph7 Stripe webhooks                | After Ph6                        |
| 11  | Checkout   | Ph8 Discounts at checkout          | After Ph6                        |
| 12  | Onboarding | Ph2 Done screen + tips             | After Onboarding Ph1             |
| 13  | MCP        | Ph3 Products + analytics tools     | After Ph2                        |
| 14  | MCP        | Ph4 Email + dropship tools         | After Ph3; dropship after Tier 2 |
| 15  | MCP        | Ph5 Audit trail + dashboard UI     | After Ph2                        |
| 16  | Onboarding | Ph3 Domain integration             | After Tier 2 Domain Ph4          |
| 17  | Onboarding | Ph4 Legal acceptance gate          | Unblocked (can go early)         |
| 18  | MCP        | Ph6 K8s deployment                 | After Ph5                        |
