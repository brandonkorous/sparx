# 89 — Sparx Feature Catalog

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-11

The single, exhaustive inventory of **everything Sparx does** — every user-facing
capability across every module, with an honest build status. The per-module PRDs
(docs/08–14, etc.) describe *intent*; this document describes *reality* as of the
date above, grounded in the actual `packages/`, `services/`, and `apps/` code, not
just the design docs.

It exists for two reasons:

1. **Internal source of truth.** When someone asks "do we do X?", the answer lives
   here, with a status, not in a slack thread.
2. **Marketing fuel.** The marketing site historically sells the **8 headline
   modules**. We actually ship _hundreds_ of discrete capabilities. The
   `/features` page on `apps/web` and the `apps/web/lib/capabilities.ts` dataset
   are derived from this catalog — keep them in sync when status changes here.

## Status legend

| Marker | Meaning |
| ------ | ------- |
| ✅ **Live** | Substantively implemented and wired into the API/UI. A tenant can use it today. |
| 🔨 **In build** | Partial / scaffolded / actively under construction. Some code exists; not yet end-to-end. |
| 🗺️ **Planned** | Designed (has a PRD/spec) but little or no code. Committed direction, not yet started. |

> Status reflects platform capability, not per-tenant activation. Every module is
> feature-flagged (locked decision #6) — "Live" means the code ships and works when
> the module is on, not that any given tenant has switched it on.

## Module map

Eleven activatable modules (`packages/modules` canonical slugs) plus the
cross-cutting platform that every module shares.

| # | Module | Slug | Headline | Status |
| - | ------ | ---- | -------- | ------ |
| 1 | Builder | `builder` | Sites, pages, themes, email — visually authored | ✅ Live |
| 2 | Commerce | `commerce` | Cart, checkout, orders, payments | ✅ Live |
| 3 | CMS | `cms` | Words, media, structured content, SEO | ✅ Live |
| 4 | CRM | `crm` | Customers, pipeline, segments, activity | ✅ Live |
| 5 | Email | `email` | Transactional + marketing on your own domain | ✅ Live |
| 6 | B2B / Wholesale / Fleet | `b2b` | Accounts, net terms, RFQ, fleet, scheduling | ✅ Live |
| 7 | Invoicing | `invoicing` | Estimates → work orders → invoices, billing documents | 🔨 In build |
| 8 | Dropship | `dropship` | Supplier sync, margin math, order routing | ✅ Live |
| 9 | Inventory | `inventory` | Multi-warehouse stock, reservations, adjustments | ✅ Live |
| 10 | Live Chat | `chat` | AI-first storefront chat + staff inbox | ✅ Live |
| 11 | AI / MCP | `ai` | First-class MCP server for Claude, ChatGPT, Copilot | ✅ Live |

Cross-cutting platform (§12–§23) ships regardless of which modules a tenant runs:
search, automation, multi-site, marketplace, auth, billing, onboarding, legal,
domains, attribution, and the dashboard shell.

---

## 1. Builder — visual authoring

The node-tree authoring system behind sites, pages, layouts, and email. One model
(`node = {box/layout/props/class}`), two surfaces (page renderer + email renderer).

### Page & site composition
- ✅ **Node-tree page model** — recursive Section/Grid/Stack/Card composition.
- ✅ **Drag-and-drop block editor** — every block responsive & accessible by default.
- ✅ **Layers panel** — collapsible node tree with dnd-kit reorder + re-parent.
- ✅ **Same-kind node retype** — convert a node to a sibling type in place.
- ✅ **Component palette** — searchable, category-grouped (Layout / Content / Data) insert.
- ✅ **Visual inspector** — Content / Style / Layout / Motion / Advanced panels per node.
- ✅ **Live canvas preview** — scoped tenant theme injected via post-message, no reload.
- ✅ **Multi-device preview** — desktop / tablet / mobile emulation in canvas.
- ✅ **Page import / export** — JSON serialization with schema validation.
- ✅ **Starter pages** — seeded Home / Product / Collection templates.
- 🗺️ **Undo / redo** — editor state model exists; undo stack not yet wired.
- 🗺️ **Collaborative / multi-user editing** — single-author today; no CRDT.

### Site layout & navigation
- ✅ **Site layout system** — persistent header/footer chrome + page content outlet.
- ✅ **Layout catalog** — many layouts per tenant; one active; publish ≠ active.
- ✅ **Per-page layout assignment** — layout defaults with per-page overrides.
- ✅ **Builder-owned navigation** — NavMenu nodes + nav-links editor (supersedes CMS menus).
- ✅ **Responsive site chrome** — 3-tier header/footer collapse with visibility rules.

### Theming & brand
- ✅ **Six curated themes** — Apex, Industrial, Drift, Market, Fleet, Drop.
- ✅ **Brand & Theme editor** — `builder/_brand`; resolves via `publishNow` → compiled tokens.
- ✅ **Token-based color system** — semantic palette + `-content` pairs, never hardcoded.
- ✅ **Font selection** — heading/body from a Google Fonts catalog.
- ✅ **Light / dark appearance policy** — both token sets compiled; storefront selects.
- ✅ **Theme toggle node** — live auto-hides unless `appearancePolicy==='toggle'`.
- ✅ **Per-tenant CSS compilation** — class-set extraction → content-hashed stylesheet.
- ✅ **Per-site brand override** — property-level brand shadows the tenant brand.

### Class-first / utility authoring
- ✅ **Utility-class authoring** — tokenized Tailwind utilities in `node.class`.
- ✅ **Four-axis style recipe** — color × variant × size × shape on every element.
- ✅ **Layout controls** — flex/grid, direction, gap, justify, align, wrap.
- ✅ **Spacing / sizing / border / radius / shadow / aspect controls** — token-backed.
- ✅ **Responsive visibility** — `hidden @md:block`-style per-breakpoint show/hide.
- ✅ **Entrance motion** — class-based reveal/stagger; reduced-motion default.
- 🔨 **Class allowlist governance** — curated vocabulary; enforcement still permissive.

### Components & data binding
- ✅ **Primitive components** — Section, Grid, Stack, Card, Carousel.
- ✅ **Content leaves** — Heading, Text, Prose (rich text), Image, Button.
- ✅ **Data-aware components** — PriceTag, ImageDisplay, Signup, Logo, NavMenu.
- ✅ **Icon picker** — searchable Lucide glyph set.
- ✅ **Tenant-authored components** — versioned, parameterized node-trees (no RCE).
- ✅ **Save-as-component** — select a subtree, save with group/icon/surfaces metadata.
- ✅ **Per-placement version pinning** — page edits don't break other pages.
- ✅ **Binding catalog** — CMS collections, Commerce, CRM lists, cart, order, site chrome.
- ✅ **Cardinality-driven rendering** — scalar / object / array (scope vs. iterate).
- ✅ **Collection router** — generic per-record render via `getPublishedByRecordType`.
- 🗺️ **External data connections** — bind REST/GraphQL/SQL as `ext.*` (docs/63, capstone).

### Publishing
- ✅ **Draft → publish lifecycle** — snapshot to published, expand components, emit event.
- ✅ **Version history + rollback** — browse and restore prior published versions.
- ✅ **Draft preview tokens** — pre-publish preview URLs (`?sparxPreview=…`).
- ✅ **Scheduled publishing** — future publish via cron scanner (legacy sitebuilder layer).
- ✅ **Per-page SEO fields** — title, description, canonical, OG image, noindex + score chip.

### Tenant blueprints
- ✅ **One-click blueprints** — provision a whole themed tenant (layout, pages, components, content, products, brand, theme).
- ✅ **Idempotent installer** — resumable install with running/installed/failed tracking.
- ✅ **Blueprint marketplace discovery** — browse + install from `/marketplace`.

### Email builder
- ✅ **Email authoring surface** — `/builder/email`; email = one node-tree (author-only).
- ✅ **Subject + preheader fields** + starter email templates.
- ✅ **Per-recipient personalization** — deferred render for recipient-bound emails.
- ✅ **Email preview** — envelope frame (sender/from/subject).
- ✅ **Real sends** — publish wired to `/email/broadcasts`.

---

## 2. Commerce

### Products & catalog
- ✅ **Products & variants** — multi-variant SKUs, price/cost/compare-at, option matrix.
- ✅ **Collections** — manual + rules-based (by tag, vendor, price, type).
- ✅ **Categories & taxonomy** — hierarchical organization.
- ✅ **Product images** — WebP/AVIF transcode, responsive srcset, CDN, primary-image flag.
- ✅ **Fitment data** — year/make/model/engine compatibility filtering (fleet/diesel).
- ✅ **Product translations** — locale-scoped title/description/SEO.
- ✅ **Bundles & configurables** — kits and user-configured products (color/size/monogram).
- ✅ **Lot & serial tracking** — batch/lot and serial-number traceability.
- ✅ **Reviews, ratings & Q&A** — verified-purchase reviews, moderation, merchant answers.
- ✅ **Wishlists** — saved items per customer.

### Pricing & discounts
- ✅ **Base pricing** — list/cost/compare-at in integer cents.
- ✅ **Bulk price tiers** — "10+ at $5 off" per variant or price list.
- ✅ **Price lists** — segment/channel/account overrides with date ranges.
- ✅ **Contract pricing** — negotiated per-account/variant prices.
- ✅ **Markup engine** — cost-driven catalog pricing (%, multiplier/keystone, flat, margin-target, cost-band matrix).
- ✅ **Markup floors/ceilings/rounding** — profit floor, margin floor, charm rounding.
- ✅ **Automatic cost-driven recompute** — worker re-derives price on cost change; auto-apply or stage for review.
- ✅ **Discount codes** — %, fixed, free-shipping, BXGY; auto or coded.
- ✅ **Discount conditions** — min order/qty, product/collection scope, usage limits.
- ✅ **Gift cards** — issue, sell, reload, redeem with balance + transaction audit.
- ✅ **Store credit** — grant/refund/spend/loyalty balances with expiry.
- ✅ **Surcharges** — card/handling/fuel fees (% or flat), payment-method gating, refund proration.

### Checkout & payments
- ✅ **Persistent carts** — guest (cookie) + authenticated, with guest→customer merge.
- ✅ **Cart abandonment** — 2-hour threshold → `cart.abandoned` event.
- ✅ **Multi-step checkout** — cart → contact → shipping → payment → review.
- ✅ **Address validation** — Google/Smarty integration.
- ✅ **Stripe payments** — card, Apple Pay, Google Pay, Link; 3DS/SCA automatic.
- ✅ **Stripe Connect** — merchant onboarding + payouts.
- ✅ **Payment provider abstraction** — pluggable; webhook idempotency + health checks.
- 🔨 **PayPal** — `provider-paypal` exists; wiring depth in progress.
- ✅ **Idempotent completion** — same key always resolves to same order.

### Tax & shipping
- ✅ **Manual tax zones/rates** + per-product tax class.
- ✅ **Tax providers** — TaxJar, Avalara, Stripe Tax.
- ✅ **Tax exemption certificates** — per customer/account with jurisdiction + upload.
- ✅ **Shipping zones & profiles** — per-product rules (carriers, hazmat, signature/freight).
- ✅ **Flat-rate shipping** — per-order/item/weight/price, free-shipping threshold.
- ✅ **Carrier-calculated rates** — EasyPost, Shippo (FedEx/UPS/USPS) + labels.
- ✅ **Local pickup** — pickup-at-warehouse option.

### Orders & fulfillment
- ✅ **Order lifecycle** — pending → confirmed → processing → fulfilled → delivered.
- ✅ **Financial states** — pending → paid/invoiced → overdue → partial/full refund.
- ✅ **Partial fulfillments** — multiple shipments per order, carrier + tracking.
- ✅ **Order timeline** — chronological event/activity log per order.
- ✅ **Confirmation + shipping emails** — fired on completion/fulfillment.
- ✅ **Refunds** — full/partial to original method, optional restock.
- ✅ **Returns / RMA** — return requests with reason, condition, inspection photos, approval.
- ✅ **Subscriptions** — recurring billing per variant; renewals + subscribe-and-save.
- ✅ **Reorder from history** — one-click repeat order.
- 🗺️ **Return shipping labels** — auto-generated carrier labels for returns.

### Reporting & ops
- ✅ **Commerce analytics** — revenue by period, orders by status, top products/customers, AOV, conversion funnel, inventory valuation.
- ✅ **CSV export** — reports, orders, customers.
- ✅ **Bulk price adjustment** — dry-run with 30-minute revert ledger.

---

## 3. CMS

- ✅ **Block editor (TipTap)** — headings, lists, quotes, tables, images, video, code, links.
- ✅ **Autosave + revision history** — 30-second autosave, last-10 versions restorable.
- ✅ **Media library** — search/filter/sort, bulk delete, alt-text/caption/focal-point editing, usage count.
- ✅ **Image pipeline** — WebP transcode + responsive variants (400/800/1200/2000px) on CDN.
- ✅ **Built-in & custom content types** — schema-driven, polymorphic (`page`, `post`, + custom).
- ✅ **Builder-authored content-type schema** — fork-on-edit, Fields rail, inline +New field.
- ✅ **Content-entry editor parity** — entry editor matches the Pages editor (autosave, SEO).
- ✅ **Per-page SEO** — title/description, OG, canonical, robots, auto JSON-LD.
- ✅ **Blog** — authors, categories/tags, scheduled publish, reading time, RSS feed, related posts.
- ✅ **Headless API + GraphQL** — fetch entries/pages/media/nav by type, scoped reads.
- ✅ **Outbound webhooks** — HMAC-signed, durable delivery, backoff + dead-letter.
- 🔨 **Localization (i18n)** — `locale_code` field present; hreflang + variants are Phase 2.
- 🗺️ **CMS deferred (Phase 5+)** — MCP content tools, approvals, AI alt-text, A/B, advanced SEO.

---

## 4. CRM

- ✅ **Unified customer record** — profile + commerce + B2B + engagement on one spine.
- ✅ **Append-only activity log** — orders, emails, quotes, logins, notes, calls, meetings; corrections insert, never update.
- ✅ **Materialized segments** — rule-based, event-updated (High Value, At Risk, New, etc.).
- ✅ **Sales pipeline & deals** — multi-pipeline, tenant-editable stages, kanban/list/forecast.
- ✅ **Multi-role contacts** — buyer/approver/viewer roles, consent + do-not-contact flags.
- ✅ **Deduplication & merge** — detect by email, merge preserving activity feeds.
- ✅ **Tasks & reminders** — linked to customers/deals, priority, assignee, overdue email.
- ✅ **CRM automations** — event triggers → email/tag/task/webhook actions.
- ✅ **CRM reporting** — pipeline funnel, win/loss, deal cycle, LTV, churn risk, rep performance.
- ✅ **CRM MCP tools** — top customers, B2B accounts, add activity, pipeline, bulk assign.
- ✅ **Two-bus delivery** — `crm.*` events publish on Pub/Sub + in-process buses.

---

## 5. Email

- ✅ **Self-hosted sending** — outbound via `email.send` → Cloud Run worker → Mailgun HTTP.
- ✅ **Sending-domain management** — auto-provision domains; DKIM/SPF/DMARC records surfaced for verification; `sparx.zone` pre-verification.
- ✅ **Default transactional automations** — order confirmed/shipped/delivered, cart abandoned, win-back, welcome, B2B approved, quote received, invoice due/overdue.
- ✅ **Custom automation rules** — trigger → conditions → delay → send, with frequency caps.
- ✅ **Template system (React Email)** — variable picker, live preview, mobile/dark previews, spam-score, test send.
- ✅ **Broadcasts** — segment-targeted campaigns, schedule or send now, recipient estimate.
- ✅ **Email analytics** — sent/delivered/opened/clicked/unsub/bounce/complaint + revenue attribution.
- ✅ **Unsubscribe + suppression** — one-click unsub, hard/soft bounce + complaint suppression, scoped (transactional/marketing/all).
- ✅ **Scheduled send queue** — per-recipient queue with dedupe/idempotency.
- ✅ **Email settings** — from name/address, reply-to, CAN-SPAM physical address footer.
- ✅ **Email MCP tools** — send broadcast, stats, pause/resume automation, list unsubscribed.

---

## 6. B2B / Wholesale / Fleet

- ✅ **B2B accounts** — company entity, multi-contact roles, credit limit + terms.
- ✅ **Account-tier pricing** — tier discounts, tier/account product overrides, deterministic resolution order.
- ✅ **Catalog visibility rules** — show/hide products by account, login-gated pricing.
- ✅ **Quantity restrictions** — min/max per product per account.
- ✅ **Fleet profiles** — vehicles (year/make/model/engine/VIN), fitment-aware catalog.
- ✅ **RFQ / quotes** — request → quote → accept → order; per-line pricing; PDF; email notifications.
- ✅ **Quote-line markup** — cost-driven markup applied at quote time, stamped.
- ✅ **Net terms & credit** — Net 15/30/60/90, PO at checkout, credit-used tracking.
- ✅ **B2B invoicing** — auto-generated on net-terms order with due-date calc.
- ✅ **Dunning ladder** — pre-due/due/overdue reminders, credit-hold @14d, suspend @30d (configurable).
- ✅ **Approval workflows** — spend caps, manager approval over threshold, pending-approval state.
- ✅ **Service scheduling** — service types, bookable appointments, fleet-vehicle snapshot, parts, reminders.
- 🔨 **B2B buyer portal** — separate login, order/invoice/quote/appointment history (`apps/b2b-portal` + storefront `/account/b2b`).

---

## 7. Invoicing & Billing Documents

- ✅ **Document workflows** — tenant-configurable ordered stages (Estimate → Approved → In Progress → Invoiced → Paid).
- ✅ **Stage configuration** — customer label, type, snapshot-on-enter, numbering (EST-/INV-), lock editing.
- ✅ **Billing line types** — part (markup), labor (rate × hours), sublet, freight, flat, catalog.
- 🔨 **Billing documents** — authored documents billing Customer/B2BAccount with cost-derived lines.
- 🔨 **Stage snapshots** — immutable frozen records for reproducibility.
- 🔨 **Document tax & surcharges** — per-document tax + surcharge engine reuse.
- 🔨 **Payments & AR** — partial payments, overdue aging, status (unpaid/partial/paid/overdue/void).
- 🗺️ **Standalone invoices** — invoices outside an order (service/consulting).
- 🗺️ **Quote → invoice conversion** — one-click convert with lines preserved.

---

## 8. Dropship

- ✅ **Supplier connectors** — Tier-1 adapters (DSers, Spocket, Faire, AutoDS), Tier-2 custom API, Tier-3 CSV.
- ✅ **Encrypted credentials** — OAuth/API key in Secret Manager.
- ✅ **Product import** — search supplier catalog, set retail price, images to GCS.
- ✅ **Import pricing rules** — cost + %, cost × N, cost + flat, cost-band matrix.
- ✅ **Catalog & inventory sync** — scheduled by tier; out-of-stock auto-hide, back-in-stock relist.
- ✅ **Automated order routing** — mixed orders split per supplier, independent submission.
- ✅ **Tracking ingestion** — supplier tracking forwarded to customer with your branding.
- ✅ **Margin & profitability reporting** — per-product/order/supplier; dashboard + MCP tools.

---

## 9. Inventory

- ✅ **Multi-warehouse** — owned / 3PL / dropship / virtual with addresses + default channels.
- ✅ **Inventory levels** — on-hand, allocated, reorder point, lead time per variant per warehouse.
- ✅ **Adjustments audit log** — sale/return/recount/loss/damage/transfer/receive/manual with reason + reference.
- ✅ **Reservations** — soft holds (cart, TTL) + hard holds (order/subscription).
- ✅ **Low-stock alerts** — thresholds → `inventory.low` events.
- ✅ **Inventory CSV import** — bulk load / adjust.
- 🗺️ **External inventory sync** — ERP/WMS source-of-truth via on-prem agent / SaaS API / file drop (docs/28).

---

## 10. Live Chat

- ✅ **Storefront chat widget** — floating bubble, history, anonymous/identified, pre-chat form, configurable greeting/hours/color/position.
- ✅ **AI-first response** — Haiku grounds on product/policy/order data (DB, not Typesense); confidence-gated handoff.
- ✅ **Staff inbox** — two-panel, filters, assignment, unread badges, typing/read receipts over WebSocket.
- ✅ **Quick replies** — canned responses with `/shortcut` autocomplete.
- ✅ **Customer context sidebar** — orders, LTV, last order.
- ✅ **Operating hours** — away message client + server side.
- ✅ **Web Push (staff)** — VAPID browser notifications + email fallback if disconnected.
- ✅ **Generic push pipeline** — `push.send` → push-worker for any module.
- 🗺️ **Customer notifications** — push/email to shoppers on staff reply.
- 🗺️ **File/image attachments** — schema allows; upload UI pending.

---

## 11. AI / MCP

- ✅ **First-class MCP server** — dedicated `api-mcp` service, tenant-scoped.
- ✅ **Multi-client** — Claude (SSE), ChatGPT/OpenAI (HTTP), Microsoft Copilot (HTTP/AAD), Cursor, any MCP client.
- ✅ **Module-gated access** — requires `ai` module; gated at transport.
- ✅ **Scoped API keys** — per-tool permission scopes; write tools confirm.
- ✅ **Read + write tools** — orders, customers/CRM, products/inventory, dropship, email, search, builder, sitebuilder.
- ✅ **Rate limiting** — per-tenant quotas (req/min, req/day, write/min).
- ✅ **Full audit trail** — every tool call logged (actor, tool, sanitized params, result, timestamp).
- ✅ **Issue/revoke keys** — dashboard AI-integrations settings with last-used tracking.

---

## 12. Search & discovery (cross-cutting)

### Universal search & Typesense
- ✅ **Typesense deployment** — GKE pod, persistent volume.
- ✅ **Products / customers / orders collections** — searchable + facetable, real-time Pub/Sub sync.
- ✅ **Full reindex** — on-demand or scheduled.
- ✅ **Typo tolerance + synonyms** — global synonym set (domain-specific).
- ✅ **Faceted filtering** — vendor, price, status, fitment, tags.
- ✅ **Fitment search** — make/model/year/engine.
- ✅ **Dashboard list search** — per-entity, Typesense-backed.
- ✅ **⌘K command palette** — global dashboard search across collections.
- ✅ **Scoped browser keys** — search-only keys for browser-direct querying.
- ✅ **Storefront search** — public faceted product search.
- 🔨 **Universal `entities` collection** — one collection + projector registry + `search.entity.changed`; Ph1 (5 projectors + `/v1/search/all` + ⌘K) built; write-site + CMS projectors pending.

### SEO / AIO discoverability
- ✅ **Sitemap** — multi-site-aware XML at `/sitemap.xml` (pages, products, collections, builder pages).
- ✅ **Redirects** — 301/302 with chain detection + hit counter; auto-create on slug change.
- ✅ **SEO fields everywhere** — builder pages, products, collections, CMS entries.
- ✅ **Dynamic OG cards** — Satori-rendered branded fallback; real images win.
- ✅ **JSON-LD** — Organization, WebSite+SearchAction, Breadcrumb, Product, Article, FAQ.
- ✅ **llms.txt + AI-crawler welcome** — curated manifest; named AI agents allowed in robots.txt.
- ✅ **SEO audit scorecard** — 12 checks / 100 points, in every editor + stored snapshots + reindex.
- ✅ **Security headers** — HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy via Caddy.
- ✅ **Core Web Vitals tracking** — marketing + dashboard (PostHog).
- 🗺️ **Markdown content endpoints** — `/<path>.md` clean Markdown for LLM ingest.
- 🗺️ **hreflang / multi-locale** — per-language sitemap + alternates.

---

## 13. Automation (cross-cutting)

- ✅ **One unified engine** — all tenant automations run here; tiers Locked / Managed / Custom.
- ✅ **Event-driven triggers** — order/customer/segment/deal/inventory/cart/quote/invoice/account/domain events.
- ✅ **Scheduled triggers** — daily/weekly/monthly predicate scans (e.g. "inactive 45+ days").
- ✅ **Conditions with entity hydration** — evaluated against resolved fields, 12 operators, AND/OR.
- ✅ **CRM actions** — create task, update deal stage, add note, add/remove tag, update field.
- ✅ **B2B escalation action** — reusable dunning ladder (credit-hold/suspend).
- ✅ **Platform actions** — outbound webhook, durable Wait, Stop.
- ✅ **Durable runs** — resumable state machine (cursor/resume_at), redeploy-safe.
- ✅ **Idempotency + loop guard** — dedupe key + depth stamp (max-depth refuse).
- ✅ **Gated execution** — mandatory policy layer; gates allow/deny/transform/defer with audit.
- ✅ **Seeded system automations** — B2B dunning Locked automation on activation.
- ✅ **Event-bus unification** — canonical EventType registry + fan-in topic teeing all events.
- 🔨 **Commerce / Email actions** — create invoice, apply discount, send campaign/internal/sequence.
- 🔨 **Dashboard UI** — tiered list, detail "duplicate to edit", run history with gate/error detail.
- 🔨 **AI automation assistant** — natural language → typed rule via MCP write-tool.
- 🔨 **Templates library** — one-click installable automations.
- 🗺️ **External integrations** — Zapier/Make/n8n apps + inbound webhook trigger.

---

## 14. Multi-site / properties (cross-cutting)

- ✅ **Property model** — many sites per tenant, exactly one primary, status lifecycle.
- ✅ **Site switcher** — lives in the header breadcrumb (dashboard + builder); cookie-tracked context.
- ✅ **Per-property domains** — multiple domains per site; primary resolution.
- ✅ **Per-property layouts & pages** — builder re-keyed to `property_id`.
- ✅ **Per-property navigation** — site-scoped menus with tenant-wide fallback.
- ✅ **Per-site content/catalog scoping (Model B)** — product/content ↔ site junctions (empty = all sites).
- ✅ **Per-site brand override** — businessName/colors/logo merged over tenant brand.
- ✅ **Per-site orders, carts & customer memberships** — origin-site tagging; memberships per property.
- 🗺️ **Per-site module scope** — disable a module on one site (field exists; enforcement deferred).
- 🗺️ **Per-site StorefrontSettings** — currency/policies/pricing visibility per site.

---

## 15. Marketplace & integrations (cross-cutting)

- ✅ **Unified marketplace** — one catalog API serving dashboard (Install) + public site (Sign up).
- ✅ **Four categories** — blueprints, themes, components, integrations (registry-driven).
- ✅ **Publisher model** — Sparx / tenant / partner publishers, RLS-scoped listings.
- ✅ **Blueprint browse + install + go-live** — gallery, detail, one-tap install → draft → live.
- ✅ **Theme & component listings** — saved token/node-tree payloads.
- ✅ **Storage-backed bundles** — payloads as GCS artifacts (icon/preview required); 30 first-party bundles ingested.
- ✅ **Integration framework** — provider adapters (ProviderBundle, OAuth, webhook routing).
- ✅ **Provider connectors** — Stripe, PayPal (payments); EasyPost, Shippo (shipping); Avalara, TaxJar (tax); dropship suppliers.
- ✅ **Integrations catalog** — purpose × shape (8 shapes), phantom facets, workflow-connector contract.
- 🗺️ **Creator marketplace submissions** — declarative `sparx.json` + payload + media, scan/review/publish.
- 🗺️ **Marketplace pricing & payouts** — paid listings + creator revenue share.
- 🗺️ **Social commerce channels** — TikTok Shop, Meta, Google Shopping, Amazon, Pinterest, Walmart (order-source tracking live; adapters pending ISV approvals).

---

## 16. Auth & security (cross-cutting)

- ✅ **Better Auth (self-hosted)** — staff email/password, magic link, OAuth; rotating refresh tokens.
- ✅ **Customer auth tier** — separate `@sparx/customer-auth`, Argon2id, opaque rotating sessions, enumeration-safe reset.
- ✅ **Row-level security** — Postgres RLS + FORCE-RLS on every tenant-scoped table.
- ✅ **API keys** — hashed, scoped, expirable, revocable, usage-tracked.
- ✅ **Role-based access** — owner/admin/editor/viewer/builder, module-gated.
- ✅ **Internal service auth** — shared-secret principals for cron/acquisition (ClusterIP-only, constant-time compare).
- ✅ **Brute-force + rate limiting** — on auth endpoints.
- 🔨 **Organizations/teams** — Better Auth org plugin staged; invite/membership UI not yet wired.
- 🗺️ **MFA / passkeys** — TOTP/SMS supported by Better Auth; enrollment UI pending.
- 🗺️ **Platform operator tier** — no interactive cross-tenant login; only internal shared-secret endpoints.

---

## 17. Billing & subscriptions (cross-cutting)

- ✅ **Module activation/deactivation** — flag in `tenant.settings.modules.<slug>.enabled`, event-invalidated cache.
- ✅ **Module-based pricing model** — per-module flat prices; no seats, no tiers (design locked).
- ✅ **Stripe Connect** — merchant account linked at onboarding.
- 🔨 **Stripe subscription billing** — customer linked, webhook receiver wired; full lifecycle pending.
- 🗺️ **Trial → grace → suspend lifecycle** — 14-day no-card trial, grace window, suspension.
- 🗺️ **Embedded Stripe customer portal** — manage modules/payment/invoices.
- 🗺️ **Domain & additional-site line items** — recurring add-ons.
- 🗺️ **Annual billing discount, enterprise & managed-hosting plans.**

---

## 18. Onboarding (cross-cutting)

- 🔨 **Modules-first wizard** — Modules → Template → Workspace → Domain → Payments → Launch (6 steps; WizardFrame primitive).
- 🔨 **Template gallery** — blueprints filtered by selected modules, with locked hints.
- 🔨 **Workspace setup** — company name, workspace slug, primary site name.
- 🔨 **Domain search & purchase** — registrar lookup in-flow (GoDaddy reseller wiring in progress).
- 🔨 **Stripe Connect step** — conditional on selling modules, skippable.
- 🔨 **Live publish step** — preview + publish the draft site.
- ✅ **Under-5-minute target, no card** — design guardrail; card collected post-launch.
- 🗺️ **Business formation step** — form LLC/S-Corp/C-Corp via FileForms; EIN pre-fill for Connect.
- 🗺️ **Welcome checklist** — post-onboarding contextual next-tasks.

---

## 19. Legal & consent (cross-cutting)

- ✅ **Tenant legal pages** — CMS entries with `legal_kind` (privacy/terms/cookie/returns/shipping/refund).
- ✅ **Legal template registry** — 6 versioned templates with required flags + disclaimers.
- ✅ **Auto-seed on tenant creation** — one draft page per template via legal-seed-worker.
- ✅ **Template versioning** — re-seed-into-draft hint; tenant edits never overwritten.
- ✅ **Cookie consent settings** — mode (off/GDPR/CCPA), categories, banner text, policy slug, version.
- ✅ **Consent banner + append-only record** — every decision logged (visitor/customer, categories, IP, UA).
- ✅ **Visitor→customer consent stitching** — edge used for attribution.
- ✅ **Platform legal docs** — versioned Sparx ToS/Privacy/DPA/AUP with acceptance tracking.
- 🗺️ **Legal completeness checklist UI** — per-kind complete/missing/stale status.
- 🗺️ **DPA for EU tenants, GDPR/CCPA enforcement dashboard.**

---

## 20. Domains (cross-cutting)

- ✅ **Platform subdomain** — `<slug>.sparx.zone` instant (wildcard DNS + SSL).
- ✅ **GoDaddy reseller integration** — search, availability, purchase, DNS config, renewal, transfer.
- ✅ **One-tap purchase + connect** — DNS auto-configured, HTTPS live in 30–60s.
- ✅ **Custom domain (BYO)** — CNAME/TXT verification, globally unique host.
- ✅ **SSL automation** — Caddy on-demand TLS on first HTTPS request.
- ✅ **DKIM/SPF/DMARC/MX** — auto-set for email authentication.
- ✅ **Renewal management** — nightly cron, auto-renew, reminders at 30/14/7/0 days.
- ✅ **WHOIS privacy upsell** + **transfer-out** (lock/unlock + auth code).
- 🔨 **Domain billing ledger** — DomainPurchase append-only; full Stripe wiring deferred.

---

## 21. Attribution & analytics (cross-cutting)

- ✅ **Platform first-touch capture (L-PLAT)** — UTM + referrer classified into channel; visitor UUID cookie.
- ✅ **Attribution taxonomy + classifier** — controlled vocabulary, deterministic channel mapping.
- ✅ **UTM link builder CLI** — taxonomy-validated tracked URLs.
- ✅ **Acquisition report** — internal cross-tenant `/internal/acquisition/summary` (shared-secret).
- 🗺️ **Tenant-level capture (L-TEN)** — storefront mirror of L-PLAT, consent-gated.
- 🗺️ **Identity stitching** — visitor → customer → order snapshotting.
- 🗺️ **Attribution models** — first/last/multi-touch (linear, position, time-decay).
- 🗺️ **Tenant channel reporting + MCP attribution tools.**

---

## 22. Admin / partner / business formation (cross-cutting)

- 🗺️ **WizeWorks admin portal** — internal `admin.wize.works`: tenant list/search/detail/impersonate, platform metrics, domain console, billing ops, support tools.
- 🗺️ **Consultant / partner program** — multi-org membership, client switcher, white-label reports, public partner directory.
- 🗺️ **Business formation** — LLC/S-Corp/C-Corp via FileForms, EIN, registered agent.

---

## 23. Dashboard shell & ops (cross-cutting)

- ✅ **Module-aware dashboard shell** — sidebar nav from module manifest, only active modules shown.
- ✅ **Workspace switcher & breadcrumb** — tenant/site switch in the header.
- ✅ **Settings hub** — general, modules, sites, domains, AI-integrations, notifications.
- ✅ **Module gating** — disabled modules block pages via ModuleGate → ModuleUpsell; API 404s.
- ✅ **Working-area standard** — PageHeader / FilterBar / FormActionBar archetypes (docs/34).
- 🔨 **Wizards** — Product wizard (4-step) built; B2B-account / email-campaign wizards planned.
- 🗺️ **CSV import/export + bulk action bar** — generic across list views (docs/68).
- 🗺️ **Billing portal embed, welcome checklist.**

---

## Maintenance

When a feature's status changes, update **three** places so the marketing site never
overstates or understates what ships:

1. This catalog (the row's status marker).
2. `apps/web/lib/capabilities.ts` (the `status` field on the matching capability).
3. The relevant module PRD (docs/08–14, etc.) if the change is material.

The `/features` page renders entirely from `capabilities.ts`, so a status change
there is what the public actually sees.
