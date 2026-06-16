# Dashboard Overview — Data Gaps & Wiring Backlog

**Version:** 2.2
**Author:** Brandon Korous / WizeWorks
**Last Updated:** 2026-06-15

---

## Purpose

Every module dashboard now opens on a founder-lens **overview** page. Those pages mix
two kinds of data:

- **Live** — fetched from a real `/v1` endpoint, fail-soft to `—` when the call errors.
- **Sample** — representative figures rendered behind a `<SampleBadge>` because no
  backing data is wired yet.

The `<SampleBadge>` makes every gap visible _in the UI_, and each page's header comment
notes its own live/sample split. This doc is the **consolidated** version of those notes,
and — crucially — it splits the sample sections into two very different buckets:

| Bucket               | Meaning                                                                                          | Effort             |
| -------------------- | ------------------------------------------------------------------------------------------------ | ------------------ |
| 🟡 **Wire-now**      | A suitable endpoint **already exists**; the overview just renders sample instead of calling it.  | Frontend-only      |
| 🔴 **Build-backend** | No endpoint exists; the metric needs a new report/analytics route (and usually new aggregation). | Backend + frontend |

The headline: a meaningful share of today's sample data is **wire-now** — it can become
real with no backend work. Those are the cheapest wins and should go first.

---

## Quick-win summary (🟡 wire-now — endpoints already live)

**Status (2026-06-14):** the first wire-now pass is **complete** — every row in this table
(Dropship, Commerce, CRM, Email) is now ✅ live via `liveOr`, falling back to a badged example
only until the tenant has data. See each module section below for specifics.

These are the sample sections whose endpoint already ships in `api-rest` today:

| Module   | Sample section showing now     | Existing endpoint to wire                                                       |
| -------- | ------------------------------ | ------------------------------------------------------------------------------- |
| Commerce | Top products                   | `GET /v1/commerce/reports/top-products`                                         |
| Commerce | Top customers                  | `GET /v1/commerce/reports/top-customers`                                        |
| Commerce | Inventory value                | `GET /v1/commerce/reports/inventory-valuation`                                  |
| CRM      | Pipeline by stage              | `GET /v1/crm/reports/pipeline-funnel?pipeline_id=`                              |
| CRM      | Win rate                       | `GET /v1/crm/reports/win-loss?pipeline_id=`                                     |
| CRM      | Top customers                  | `GET /v1/crm/customers/top`                                                     |
| CRM      | Tasks (overdue / today)        | `GET /v1/crm/tasks/overdue`, `GET /v1/crm/tasks/today`                          |
| CRM      | Segment sizes                  | `GET /v1/crm/segments/:id/member-count`                                         |
| Email    | Recent broadcasts + open/click | `GET /v1/email/broadcasts` + `GET /v1/email/broadcasts/:id/stats`               |
| Email    | Domain SPF/DKIM/DMARC status   | `GET /v1/email/domains`                                                         |
| Dropship | Supplier breakdown             | already in `GET /v1/dropship/analytics` response — render the per-supplier rows |
| Dropship | Per-order margin list          | `GET /v1/dropship/analytics/orders`                                             |

---

## Per-module breakdown

Module color is shown for orientation. ✅ = live today, 🟡 = wire-now, 🔴 = build-backend.

### Storefront / Site builder — Indigo

- ✅ Blueprint teaser — `GET /v1/blueprints`
- ✅ Pages & content — published vs draft page counts (`GET /v1/builder/pages`) + saved-component count (`GET /v1/builder/components`) (wired 2026-06-15, docs/builder/06)
- ✅ Status hero — pages-live, last-published, and the **unpublished-changes** count derived from the page + layout catalog timestamps (`GET /v1/builder/pages` + `/v1/builder/layouts`; a draft is unpublished when never published or `updatedAt > publishedAt`) + domain & SSL from `GET /v1/domains` (canonical/verified). The uptime/performance tiles (no telemetry) were replaced with real Components + avg-SEO-score tiles (wired 2026-06-15).
- ✅ Site health — SSL (`GET /v1/domains`) + SEO metadata coverage & avg score (`GET /v1/seo/audits?type=builder_page`). The performance/mobile/sitemap rows were dropped (need telemetry) rather than badged.
- ✅ Needs attention — real SEO issues: worst-scoring builder pages + their `fixFirst` from `GET /v1/seo/audits?type=builder_page`. (Broken-links / alt-text would need a published-tree scan — not covered.)
- ✅ Recent activity — derived from the page/layout catalog timestamps (created → edited → published, most-recent-first). Real "what + when"; no actor ("who") without audit-log instrumentation of builder mutations.
- ✅ Editor entry-points open the unified editor `/builder/studio` (docs/builder/07 cutover) — Brand → `?zone=theme`, Site → `?zone=layout`, Page → page zone
- ✅ Analytics — visitors / pageviews / signups KPIs, the traffic chart, traffic sources, and top pages — `GET /v1/builder/analytics/{summary,timeseries,top-pages,sources}` (shipped 2026-06-15). **Net-new first-party capture**, built end to end: a cookieless, PII-free storefront beacon (`apps/site`, respects DNT + the tenant's cookie-consent `analytics` category) POSTs each pageview to `POST /v1/public/site/collect`, which derives a salted daily-rotating visitor hash from the request IP+UA (never stored) and writes `site_analytics_events` (RLS). A nightly reconcile rolls those into `rollup_site_daily` (`POST /internal/site/analytics-rollup` + k8s CronJob); the read serves rollup-for-closed-days + live-overlay-today + a cold-start, per the active site (`x-sparx-property-id`). Each card `liveOr`-falls back to a badged sample until the site has traffic. The "Top pages" table now shows views + unique visitors (avg-time/conversion need per-visit session capture).
- ✅ "Avg. load time" KPI — real-user web-vitals capture (shipped 2026-06-15): the storefront beacon captures the page load time, LCP and CLS once per load (native `PerformanceObserver` + Navigation Timing, no `web-vitals` dependency) and POSTs them as `type:'vital'` rows on `site_analytics_events` (new `metric` + `value` columns). The KPI reads `GET /v1/builder/analytics/vitals` (AVG per metric over the window) and goes live once timing samples land, else stays badged sample.

### Commerce — Orange

- ✅ Revenue summary — `GET /v1/commerce/reports/revenue-summary`
- ✅ Conversion funnel — `GET /v1/commerce/reports/conversion-funnel`
- ✅ Subscription metrics — `GET /v1/commerce/reports/subscription-metrics`
- ✅ Abandoned carts — `GET /v1/commerce/reports/abandoned-carts`
- ✅ Top products — `GET /v1/commerce/reports/top-products` (wired 2026-06-14)
- ✅ Top customers — `GET /v1/commerce/reports/top-customers` (wired 2026-06-14; replaced the unbacked new-vs-returning donut)
- ✅ Inventory value — `GET /v1/commerce/reports/inventory-valuation` (wired 2026-06-14; units + stock value on the Inventory card)
- ✅ Sales **timeseries** — `GET /v1/commerce/reports/revenue-timeseries` (shipped 2026-06-15; **first rollup** — `rollup_commerce_daily_revenue` + nightly reconcile + live-overlay read per docs/97 §5; powers the Revenue chart + Gross/Refunds/Discounts/Net footer)
- ✅ Channel breakdown (orders + revenue by `channel`: storefront/b2b_portal/admin/import/mcp) — `GET /v1/commerce/reports/channel-breakdown` (shipped 2026-06-15). The referrer/UTM "traffic sources" half still needs site-analytics event capture (workload B).
- ✅ Discount performance (per-discount redemptions / discount given / unique orders) — `GET /v1/commerce/reports/discount-performance` (shipped 2026-06-15)

### CMS / Content — Teal

- ✅ Counts (published-30d / drafts / scheduled / total) + status pipeline + content-by-type — `GET /v1/content/reports/summary` (shipped 2026-06-15)
- ✅ Publishing **cadence** (entries published per day/week/month) — `GET /v1/content/reports/cadence` (shipped 2026-06-15; live aggregate over `content_entries`, same daily-bucket chart shape as the rollups)
- ✅ Recently-published / upcoming-scheduled / recent-activity feeds — `GET /v1/content/reports/recent` (shipped 2026-06-15)
- ✅ **Top content by views** — `GET /v1/content/reports/top-content` (shipped 2026-06-15): joins first-party site-analytics pageviews to each published entry's resolved public path (`urlPattern.replace('{slug}', slug)` — the same construction the sitemap uses — normalized with the beacon's `normalizePath`), scoped to the active site. The CMS overview's "Top content by views" card (views + visitors per entry + window total) goes live once the site captures traffic, else `liveOr`-falls back to a badged sample. Unlocked by the site-analytics capture that landed with the Builder overview.
- 🔴 Read-time / time-on-page — still needs dwell-time capture (a beacon unload/heartbeat event) we don't collect yet

### CRM — Cyan

- ✅ Snapshot KPIs — `GET /v1/crm/reports/snapshot`
- ✅ Customer growth — `GET /v1/crm/reports/acquisition?months=12`
- ✅ Pipeline by stage + open-deal split — `GET /v1/crm/reports/pipeline-funnel?pipeline_id=` (wired 2026-06-14; pipeline id from `GET /v1/crm/pipelines`)
- ✅ Win rate — `GET /v1/crm/reports/win-loss?pipeline_id=` (wired 2026-06-14; KPI)
- ✅ Top customers — `GET /v1/crm/customers/top` (wired 2026-06-14)
- ✅ Tasks due today — `GET /v1/crm/tasks/today` (wired 2026-06-14)
- ✅ Segment sizes — `GET /v1/crm/segments` + `GET /v1/crm/segments/:id/member-count` (wired 2026-06-14)
- ✅ New · 30d KPI — derived from the latest `GET /v1/crm/reports/acquisition` month (wired 2026-06-14)
- ✅ Leads-by-source — `GET /v1/crm/reports/leads-by-source` (shipped 2026-06-15; the CRM has no structured `source` column, so source is derived from each new customer's **first-order channel** (storefront/b2b_portal/admin/import/mcp), falling back to b2b/direct)
- ✅ Aggregate task metrics — `GET /v1/crm/reports/tasks` (open/overdue/due-today/completed-30d + open-task priority mix)
- ✅ Cross-segment summary — `GET /v1/crm/reports/segments` (every active segment + member count in one call)

### Email — Sky

- ✅ Engagement & deliverability (sent, opens, clicks, bounces, complaints, suppressions, open/click rate) — `GET /v1/email/analytics/overview?days=30`
- ✅ Recent broadcasts (sent date, recipients, open/click) — `GET /v1/email/broadcasts` + per-send `/:id/stats` (wired 2026-06-14; revenue column dropped — no attribution endpoint)
- ✅ Sending-domain verification — `GET /v1/email/domains` (wired 2026-06-14; replaced the fabricated 98/100 score + static SPF/DKIM/DMARC "Pass" rows with live per-domain state)
- ✅ Subscriber-growth / list-size timeseries — `GET /v1/email/analytics/subscriber-growth` (shipped 2026-06-15; the email module has no subscriber table, so list growth is derived: contacts added (customers w/ email) − removed (marketing suppressions) per bucket, plus the current mailable list size)
- 🔴 Revenue attribution — needs conversion event capture (workload B): tying an order back to an email click requires a click→order link that doesn't exist yet

### B2B — Slate

- ✅ Account health + open quotes + invoices (outstanding/overdue/aging) + approval-queue + credit + tier split — `GET /v1/b2b/reports/summary` (shipped 2026-06-15)
- ✅ Order volume / revenue **timeseries** — `GET /v1/b2b/reports/timeseries` (shipped 2026-06-15; live aggregate over b2b_portal orders, same daily-bucket chart shape as the rollups)
- ✅ Open-quotes list + top-accounts (by invoiced amount) — `GET /v1/b2b/reports/open-quotes`, `GET /v1/b2b/reports/top-accounts` (shipped 2026-06-15)
- 🔴 Pending applications (no application model) + activity feed (no event log) — stay sample

### AI — Rose

- ✅ MCP usage (requests, success rate, distinct tools), the activity chart, top tools, API-key counts, automation runs, the combined "AI actions" total, and the recent-activity feed — `GET /v1/ai/reports/{summary,timeseries,top-tools,activity}` (shipped 2026-06-15). **No new capture needed**: every MCP tool call already lands in `audit_logs` (`entity_type='McpToolCall'`, `action='mcp.<tool>'`, `diff={input,outcome}` — services/api-mcp/src/audit.ts), so the whole MCP surface is a LIVE aggregate over that table. AI-module-gated (`lib/ai-context.ts`), viewer-read, tenant-scoped. Each tile `liveOr`-falls back to a badged sample until the tenant has MCP traffic
- 🔴 Tokens / cost / model-mix — **not ours to capture**: the agent's LLM spend (model, tokens, $) lives in the _caller's_ LLM account, never on our MCP server. The "Usage & cost" card stays sample (workload B) unless/until a first-party copilot with server-side LLM calls ships
- 🔴 Connected-surfaces permissions, approval queue, the automations table — sample until their own capture/endpoints land (automations have `/v1/automations`, not yet wired onto this overview)

### Dropship — Emerald

- ✅ Headline KPIs (revenue, orders, margin) — `GET /v1/dropship/analytics`
- ✅ Supplier profitability table + orders-by-supplier donut — wired to the `bySupplier` breakdown in `GET /v1/dropship/analytics`, with `liveOr` fallback to sample (2026-06-14)
- ✅ Per-order margin list — `GET /v1/dropship/analytics/orders` now surfaced as the "Recent routed orders" table (order # / supplier / status / revenue / cost / profit / margin), `liveOr` fallback to sample (shipped 2026-06-15)
- ✅ Supplier SLA (on-time %, fulfillment rate, avg ship/delivery) — `GET /v1/dropship/reports/supplier-sla`: derived **live** from the DropshipOrder lifecycle stamps (submittedAt → shippedAt → deliveredAt), overall + per-supplier; powers the "On-time delivery" KPI. The timestamps ARE the delivery telemetry (shipped 2026-06-15)
- ✅ Revenue/orders **timeseries** — `GET /v1/dropship/reports/orders-timeseries` (shipped 2026-06-15; **third rollup** — `rollup_dropship_daily_orders` + nightly reconcile + live-overlay read per docs/97 §5; powers the "Order volume" chart + Routed/Revenue/Margin footer)
- ✅ Activity feed — `GET /v1/dropship/reports/activity`: most recently-touched routed orders (status + order # + supplier), `updatedAt` as the lifecycle proxy; powers the "Recent activity" timeline (shipped 2026-06-15)
- 🔴 Reconciliation + routing rules — no backing model yet; remain sample behind `<SampleBadge>`

### Invoicing — Lime

- ✅ A/R aging buckets — `GET /v1/invoicing/aging`
- ✅ Recent documents — `GET /v1/invoicing/documents?take=6`
- ✅ Workflows — `GET /v1/invoicing/workflows`
- ✅ Collected-over-time timeseries — `GET /v1/invoicing/reports/collected-timeseries` (shipped 2026-06-15; **second rollup** — `rollup_invoicing_daily_collected` + nightly reconcile + live-overlay read per docs/97 §5; powers the collected-vs-billed chart + Collected/Billed/rate footer + the Collected · 30d KPI)
- ✅ Days-to-pay (avg + median) + collections summary (collected this/last month, paid-in-full, deposits) + open-balance-by-stage — `GET /v1/invoicing/reports/collections` (shipped 2026-06-15)
- ✅ Customer breakdown ("who owes you", top debtors by outstanding) — `GET /v1/invoicing/reports/customer-breakdown` (shipped 2026-06-15)
- 🔴 Reminder-automation stats (reminders sent over time) — needs a reminder event log (workload B); reminders flow through automations/email events, not a dedicated table

### Inventory — Amber

- ✅ Location & source **counts** — `GET /v1/inventory/locations`, `GET /v1/inventory/sources`
- ✅ Valuation (units + cost/retail) + stock-status (out/low/healthy) + per-location quantities + source-feed health + low/out attention list — `GET /v1/inventory/reports/summary` (shipped 2026-06-15; live aggregates over the module's `stock_levels`, joined to variant cost/retail; "low" is a fixed available-units threshold since the module's StockLevel has no reorder point)
- ✅ Recent stock changes feed — `GET /v1/inventory/reports/activity` (recently-updated stock levels; a movement-feed proxy)
- ✅ **Value over time** — `GET /v1/inventory/reports/valuation-timeseries` (shipped 2026-06-15): a nightly snapshot cron (`/internal/inventory/valuation-snapshot` + k8s CronJob) captures today's valuation (units + value at cost/retail, mirroring the summary definition) into `rollup_inventory_daily_valuation`; the read returns the daily series + a live-overlay of today's current valuation. Because stock has no per-day movement ledger, this is a point-in-time snapshot that **builds forward from first capture** (no historical backfill); the chart goes live once ≥2 days are captured, else badged sample.
- 🔴 Purchase orders (no PO model) — stay sample; needs a PO model the module doesn't have yet

### Chat — Violet

- ✅ Conversation pulse (open / active / unassigned counts, recent list) — `GET /v1/chat/conversations?take=50`
- ✅ AI-vs-human resolution, volume timeseries, channel mix, agent performance, activity — `GET /v1/chat/analytics/{summary,timeseries,agents,activity}` (shipped 2026-06-15): **live** aggregates over `chat_conversations` + `chat_messages` — resolution split (resolved with 0 staff messages = AI-handled), started/resolved per-day series, avg first-response latency, source mix, first-responder rollup (staff + AI), recent-message feed. Each `liveOr`-falls back to a badged sample until the tenant has chat history
- 🔴 CSAT — no rating-capture model yet (workload B); the CSAT KPI stays sample until a post-chat rating is captured on a conversation

### Automations — Fuchsia

- ✅ Automation list → total / active counts + by-trigger split — `GET /v1/automations`
- ✅ Per-automation run history — `GET /v1/automations/:id/runs`
- ✅ Run-activity **timeseries** & success-rate — `GET /v1/automations/reports/runs` (shipped 2026-06-15; **fourth rollup** — `rollup_automation_daily_runs` + nightly reconcile + live-overlay read per docs/97 §5; aggregate across every automation, powers the "Run activity" chart + Runs/Success-rate footer)

### SEO — Live

- ✅ Health score, pages scored, issue breakdown, worst-pages table — `GET /v1/seo/audits`
- ✅ Technical checklist status & activity feed — `GET /v1/seo/reports/{checklist,activity}` (shipped 2026-06-15): the checklist **rolls every page's audit `card->'checks'` up site-wide** (per check: how many pages pass/warn/fail → a derived site status + pass rate, attention-first); the activity feed reads recent audit runs (`computedAt` desc). Both `liveOr`-fall back to a badged sample until the site is audited. The checklist is the REAL audit signal (title/description/structured-data/alt-text/headings/sitemap/indexable/…), not invented sitemap/robots/CWV rows
- ✅ Organic clicks / impressions / CTR / avg position, top queries — **Google Search Console ingestion** (shipped 2026-06-15): full per-tenant OAuth connector. `GET /v1/seo/search-console/status` + the connect lifecycle (`connect-url` → dashboard-hosted callback → `exchange` → `select-site`, plus `sync`/disconnect); a nightly `search-console-sync` CronJob (and "Sync now") pulls the Search Analytics API and overwrites `rollup_search_console_daily` + `search_console_queries` (RLS, impression-weighted `sum_position` so avg position aggregates across days). Reads via `GET /v1/seo/organic/{summary,timeseries,top-queries}`; the overview's KPIs + organic chart + top-queries go live once a tenant connects, else `liveOr`-fall back to a badged sample with a **"Connect Search Console"** CTA. OAuth tokens are AES-256-GCM-encrypted at rest. **Inert** until the platform sets `GOOGLE_OAUTH_CLIENT_ID/_SECRET` + `SEARCH_CONSOLE_TOKEN_KEY` and each tenant authorizes their property

---

## Suggested order of work

1. **🟡 Wire-now pass (frontend-only).** Commerce (top products, top customers, inventory value), CRM (pipeline, win rate, top customers, tasks, segment sizes), Email (broadcasts, domains), Dropship (supplier breakdown, orders). Each drops a `<SampleBadge>` and replaces sample constants with an `api.get(...)` call — no backend change.
2. **🔴 Timeseries reports** are the most common backend gap and power the signature charts: commerce `revenue-timeseries` **✅ (shipped 2026-06-15 — the rollup reference impl, docs/97)**, invoicing `collected-timeseries` **✅ (shipped 2026-06-15 — `rollup_invoicing_daily_collected`)**, dropship `reports/orders-timeseries` **✅ (shipped 2026-06-15 — `rollup_dropship_daily_orders`)**, automations `reports/runs` **✅ (shipped 2026-06-15 — `rollup_automation_daily_runs`)**. **All four signature timeseries are now live.** The shared "daily bucket over a date range" rollup pattern (table + nightly reconcile + live-overlay read) is established — copy it for the remaining metric rollups (CMS counts, B2B reporting, invoicing days-to-pay, etc.).
3. **🔴 Net-new analytics surfaces** (larger): site analytics (builder), chat analytics, CMS reporting, B2B reporting, and the entire AI reports surface. These need new aggregation + likely event capture, not just a query.
4. **External ingestion:** SEO Search Console (organic traffic / queries) **✅ (shipped 2026-06-15 — full per-tenant OAuth connector + nightly ingestion, inert until OAuth creds are provisioned)**. Email revenue attribution still depends on conversion event capture we don't yet collect.

When a section graduates from sample to live, delete its `<SampleBadge>` and update its row here.
