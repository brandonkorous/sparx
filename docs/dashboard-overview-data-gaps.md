# Dashboard Overview — Data Gaps & Wiring Backlog

**Version:** 1.2
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
- ✅ Pages & content — published vs draft page counts (`GET /v1/builder/pages`) + saved-component count (`GET /v1/builder/components`) (wired 2026-06-15, docs/builder/06; `liveOr` fallback to a badged example)
- ✅ Editor entry-points open the unified editor `/builder/studio` (docs/builder/07 cutover) — Brand → `?zone=theme`, Site → `?zone=layout`, Page → page zone
- 🔴 Every KPI (page views, sessions, visitors, top pages, traffic over time, traffic sources, email signups) — **no site-analytics endpoint exists.** Needs an analytics ingestion + reporting surface (`/v1/builder/analytics/*` or a dedicated analytics service). The largest gap; sequenced under "net-new analytics surfaces".
- 🔴 Status hero publish facts (last-published, unpublished-changes diff, uptime, performance) — `publishedAt` is on the page/layout DTOs, but the **unpublished-changes** count needs a draft-vs-published **diff** endpoint (modest); uptime/perf need telemetry.
- 🔴 Site health (SEO metadata coverage, SSL, sitemap, performance) — partially wire-now: SEO coverage from `GET /v1/seo/audits?type=builder_page`, SSL from `GET /v1/domains`; sitemap/perf need telemetry.
- 🔴 Needs-attention scan (missing meta, broken links, missing alt) — a background scan over the published tree (modest job), not an on-render compute.
- 🔴 Recent activity — needs a builder activity/audit-feed endpoint.

### Commerce — Orange

- ✅ Revenue summary — `GET /v1/commerce/reports/revenue-summary`
- ✅ Conversion funnel — `GET /v1/commerce/reports/conversion-funnel`
- ✅ Subscription metrics — `GET /v1/commerce/reports/subscription-metrics`
- ✅ Abandoned carts — `GET /v1/commerce/reports/abandoned-carts`
- ✅ Top products — `GET /v1/commerce/reports/top-products` (wired 2026-06-14)
- ✅ Top customers — `GET /v1/commerce/reports/top-customers` (wired 2026-06-14; replaced the unbacked new-vs-returning donut)
- ✅ Inventory value — `GET /v1/commerce/reports/inventory-valuation` (wired 2026-06-14; units + stock value on the Inventory card)
- ✅ Sales **timeseries** — `GET /v1/commerce/reports/revenue-timeseries` (shipped 2026-06-15; **first rollup** — `rollup_commerce_daily_revenue` + nightly reconcile + live-overlay read per docs/97 §5; powers the Revenue chart + Gross/Refunds/Discounts/Net footer)
- 🔴 Traffic sources / channel breakdown — no endpoint
- 🔴 Discount performance — no endpoint (only `/discounts` CRUD)

### CMS / Content — Teal

- 🔴 **Everything.** No content reporting exists. Counts (published / draft / scheduled) could be derived from `GET /v1/content` lists as a stopgap, but views, top content, and publishing cadence need a new `/v1/content/reports/*` surface.

### CRM — Cyan

- ✅ Snapshot KPIs — `GET /v1/crm/reports/snapshot`
- ✅ Customer growth — `GET /v1/crm/reports/acquisition?months=12`
- ✅ Pipeline by stage + open-deal split — `GET /v1/crm/reports/pipeline-funnel?pipeline_id=` (wired 2026-06-14; pipeline id from `GET /v1/crm/pipelines`)
- ✅ Win rate — `GET /v1/crm/reports/win-loss?pipeline_id=` (wired 2026-06-14; KPI)
- ✅ Top customers — `GET /v1/crm/customers/top` (wired 2026-06-14)
- ✅ Tasks due today — `GET /v1/crm/tasks/today` (wired 2026-06-14)
- ✅ Segment sizes — `GET /v1/crm/segments` + `GET /v1/crm/segments/:id/member-count` (wired 2026-06-14)
- ✅ New · 30d KPI — derived from the latest `GET /v1/crm/reports/acquisition` month (wired 2026-06-14)
- 🔴 Leads-by-source — no lead-source tracking in the report layer
- 🔴 Aggregate task metrics & cross-segment summary — only per-entity lists/counts exist

### Email — Sky

- ✅ Engagement & deliverability (sent, opens, clicks, bounces, complaints, suppressions, open/click rate) — `GET /v1/email/analytics/overview?days=30`
- ✅ Recent broadcasts (sent date, recipients, open/click) — `GET /v1/email/broadcasts` + per-send `/:id/stats` (wired 2026-06-14; revenue column dropped — no attribution endpoint)
- ✅ Sending-domain verification — `GET /v1/email/domains` (wired 2026-06-14; replaced the fabricated 98/100 score + static SPF/DKIM/DMARC "Pass" rows with live per-domain state)
- 🔴 Subscriber-growth / list-size timeseries — no endpoint
- 🔴 Revenue attribution — no endpoint

### B2B — Slate

- ✅ Active account count — `GET /v1/b2b/accounts` (meta.total)
- 🟡 Open quotes / pending invoices / approval-queue counts — derivable from existing CRUD lists (`/quotes`, `/invoices`, `/approval`) as a stopgap
- 🔴 B2B reporting (order volume over time, revenue, approvals over time) — no reporting endpoint

### AI — Rose

- 🔴 **Everything.** There is no `services/api-rest/src/routes/v1/ai/` folder at all. The entire `/v1/ai/reports/*` surface (usage, tokens, tool calls, cost, top intents) must be built before any tile goes live.

### Dropship — Emerald

- ✅ Headline KPIs (revenue, orders, margin) — `GET /v1/dropship/analytics`
- ✅ Supplier profitability table + orders-by-supplier donut — wired to the `bySupplier` breakdown in `GET /v1/dropship/analytics`, with `liveOr` fallback to sample (2026-06-14)
- 🟡 Per-order margin list — `GET /v1/dropship/analytics/orders` exists; not yet surfaced on the overview (no section for it)
- 🔴 Supplier SLA (on-time %, fill rate, avg ship) — no delivery telemetry; the old "Supplier health" table invented these, now replaced by the live profitability table
- 🔴 Revenue/orders **timeseries** — no endpoint (`…/analytics` is point-in-time)
- 🔴 Activity feed — no endpoint

### Invoicing — Lime

- ✅ A/R aging buckets — `GET /v1/invoicing/aging`
- ✅ Recent documents — `GET /v1/invoicing/documents?take=6`
- ✅ Workflows — `GET /v1/invoicing/workflows`
- ✅ Collected-over-time timeseries — `GET /v1/invoicing/reports/collected-timeseries` (shipped 2026-06-15; **second rollup** — `rollup_invoicing_daily_collected` + nightly reconcile + live-overlay read per docs/97 §5; powers the collected-vs-billed chart + Collected/Billed/rate footer + the Collected · 30d KPI)
- 🔴 Days-to-pay — no endpoint
- 🔴 Customer breakdown — no endpoint
- 🔴 Reminder-automation stats — no endpoint

### Inventory — Amber

- ✅ Location & source **counts** — `GET /v1/inventory/locations`, `GET /v1/inventory/sources`
- 🔴 Stock valuation, low/out-of-stock list, per-location quantities, POs, activity — the standalone inventory module has **only CRUD** (locations / sources / links). (Commerce has `inventory-valuation` + `inventory/low-stock`, but those are commerce-scoped and don't cover the multi-source inventory module.)

### Chat — Violet

- ✅ Conversation pulse (open / active / unassigned counts, recent list) — `GET /v1/chat/conversations?take=50`
- 🔴 AI-vs-human resolution, volume timeseries, channel mix, agent performance, CSAT, activity — no chat analytics endpoint

### Automations — Fuchsia

- ✅ Automation list → total / active counts + by-trigger split — `GET /v1/automations`
- 🟡 Per-automation run history exists (`GET /v1/automations/:id/runs`) but there is no aggregate
- 🔴 Run-activity timeseries & success-rate report — new `…/reports/runs` (aggregate across automations)

### SEO — Yellow

- ✅ Health score, pages scored, issue breakdown, worst-pages table — `GET /v1/seo/audits`
- 🔴 Organic clicks / impressions / CTR / avg position, top queries — needs **Search Console ingestion** (no endpoint)
- 🔴 Technical checklist status (sitemap, robots, structured data, CWV) & activity feed — no endpoint

---

## Suggested order of work

1. **🟡 Wire-now pass (frontend-only).** Commerce (top products, top customers, inventory value), CRM (pipeline, win rate, top customers, tasks, segment sizes), Email (broadcasts, domains), Dropship (supplier breakdown, orders). Each drops a `<SampleBadge>` and replaces sample constants with an `api.get(...)` call — no backend change.
2. **🔴 Timeseries reports** are the most common backend gap and power the signature charts: commerce `revenue-timeseries` **✅ (shipped 2026-06-15 — the rollup reference impl, docs/97)**, invoicing `collected-timeseries` **✅ (shipped 2026-06-15 — `rollup_invoicing_daily_collected`)**, then dropship `…/analytics?timeseries`, automations `reports/runs`. The shared "daily bucket over a date range" rollup pattern (table + nightly reconcile + live-overlay read) is now established — copy it for the rest.
3. **🔴 Net-new analytics surfaces** (larger): site analytics (builder), chat analytics, CMS reporting, B2B reporting, and the entire AI reports surface. These need new aggregation + likely event capture, not just a query.
4. **🔴 External ingestion:** SEO Search Console (organic traffic / queries) and email revenue attribution depend on data we don't yet collect.

When a section graduates from sample to live, delete its `<SampleBadge>` and update its row here.
