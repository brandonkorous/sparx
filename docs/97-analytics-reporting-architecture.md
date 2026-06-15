# Analytics & Reporting Architecture

**Version:** 1.4
**Author:** Brandon Korous / WizeWorks
**Last Updated:** 2026-06-15

---

## 1. Why this doc exists

The module dashboards now open on founder-lens **overview** pages, but most of their
charts and breakdowns render sample data behind a `<SampleBadge>` because the reporting
data isn't wired yet. The full inventory of what's live vs. sample — and which sample
sections already have an endpoint vs. need one built — is in
[dashboard-overview-data-gaps.md](dashboard-overview-data-gaps.md).

This doc decides **how** we build the missing reporting layer, under two hard constraints:

1. **Stay cheap as long as possible** — no new always-on infrastructure without a stated
   scale/revenue trigger ([03-infrastructure-deployment.md](03-infrastructure-deployment.md) §3;
   the same phasing discipline as [22-typesense-search-spec.md](22-typesense-search-spec.md)).
2. **Be fast** — the overview is the first screen a tenant sees; reporting queries must
   never contend with the operational hot path (checkout, orders, auth).

The decision in one line: **no separate analytics API and no separate analytics database yet.
Pre-compute with the worker/cron fleet we already run, store rollups in the existing
Postgres, and read them through isolated, cached endpoints in `api-rest`.** Graduate to a
read replica → a dedicated service → a columnar warehouse only when named triggers fire.

---

## 2. "Analytics" is two workloads, not one

Treating reporting as one thing is the trap. The gap doc's missing metrics split cleanly:

|                  | **A. Reporting over data we already have**                                                       | **B. Event/telemetry we don't collect yet**                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Examples         | commerce sales, invoicing collected, dropship margin, CRM pipeline, B2B revenue, automation runs | site analytics (page views / sessions / visitors), AI token usage, chat volume, CSAT |
| Source           | existing operational tables                                                                      | nothing — must be **captured** first                                                 |
| New write volume | none                                                                                             | **high**, append-only                                                                |
| Real cost        | heavy `GROUP BY` aggregation                                                                     | ingestion + retention of raw events                                                  |
| Cheap answer     | **rollup tables** in the same Postgres                                                           | **event-capture table** → nightly rollup → prune                                     |

Most of the gap is **A**. Only site analytics (and later AI usage, chat volume, CSAT) is
genuinely **B**. They get different homes (§5, §6). This is why "separate DB or separate
tables — or both?" resolves to: **own tables yes, separate DB no** — and the "own tables"
are rollups/event-capture, not duplicates of operational data.

---

## 3. The shape: move computation off the request path

`api-rest` is the heavy central service. The contention risk isn't that reporting _lives_
there — it's that a heavy aggregation would run **synchronously in a request**, competing
for the Node event loop and the Postgres connection pool with checkout and orders. A second
service hitting the _same_ Postgres wouldn't fix that; both still contend at the DB. The fix
is to never compute on the hot path:

```
  COMPUTE (existing fleet)                 STORE (same Postgres)          READ (api-rest, isolated)
  ┌─────────────────────────┐
  │ Pub/Sub event workers   │──increment──►  rollup / summary tables  ──►  GET /v1/<m>/reports/<name>
  │ (order.created, …)       │               (tenant_id, bucket, …)         • Redis-cached (short TTL)
  ├─────────────────────────┤               event-capture tables           • capped read pool
  │ scheduled cron          │──reconcile──►  (partitioned, append-only)     • statement_timeout
  │ (nightly recompute)     │                                               reads pre-aggregated rows →
  └─────────────────────────┘                                               milliseconds, cheap
```

- **Compute** runs on the worker/cron fleet we already operate (`email-worker`,
  `markup-recompute-worker`, the Pub/Sub consumers, and the internal cron routes). We already
  do exactly this: [services/api-rest/src/routes/internal/acquisition-report.ts](../services/api-rest/src/routes/internal/acquisition-report.ts)
  - [crm-cron.ts](../services/api-rest/src/routes/internal/crm-cron.ts) is a cron-fed CRM
    rollup. **Extend that pattern; don't invent a new one.**
- **Store** in the same Postgres as purpose-built rollup/summary tables (§5) and, for
  workload B only, partitioned event-capture tables (§6).
- **Read** stays in `api-rest` but isolated (§7): pre-aggregated rows are a trivial indexed
  range scan, the response is cached in the Redis we already run in-pod, and a dedicated
  capped read pool + `statement_timeout` guarantees a runaway report can't starve operations.

This is dead-on with the house conventions: event-driven side effects via Pub/Sub, phased
cheap infra, RLS-by-default. See [82-event-bus-unification.md](82-event-bus-unification.md)
for the event substrate the incremental updates ride on.

---

## 4. What we are explicitly NOT doing yet (and why)

- **Separate analytics API service — no.** Adds pods, deploys, and ops cost without solving
  the real contention (same DB). It earns its place at a named trigger (§8.2), pointed at a
  read replica — not before.
- **Separate analytics database with duplicated operational data — no.** Duplicating data we
  already store means a CDC/ETL pipeline, eventual-consistency bugs, and double storage — to
  query rows already in Postgres. Rollups in the _same_ Postgres are cheaper and have no sync
  problem.
- **An always-on columnar store (ClickHouse, etc.) — no.** It needs running pods you pay for
  at zero traffic. When raw-event volume eventually justifies a warehouse, the cheap-first,
  GCP-native choice is **BigQuery** (serverless, no idle cost, pay-per-query) — §8.3.

---

## 5. Rollup tables (workload A)

A rollup table is a tenant-scoped, pre-aggregated summary keyed by a time bucket (and
optional dimension). Reads become indexed range scans.

**Conventions**

- **Name:** `rollup_<module>_<grain>_<measure>` — e.g. `rollup_commerce_daily_revenue`,
  `rollup_invoicing_daily_collected`, `rollup_automation_daily_runs`.
- **Columns:** `tenant_id uuid not null`, `bucket date not null` (or `bucket_start timestamptz`
  for sub-day grain), one column per measure (counts/sums as `bigint`; money in cents),
  optional `dimension` column(s) for breakdowns (e.g. `supplier_id`, `stage`, `channel`),
  `updated_at timestamptz not null default now()`.
- **Primary key:** `(tenant_id, bucket[, dimension])` — covers the dominant query
  (`WHERE tenant_id = $1 AND bucket BETWEEN $2 AND $3`).
- **RLS is mandatory** like every tenant-scoped table: `tenant_id`, a `current_tenant_id()`
  policy, and `FORCE ROW LEVEL SECURITY`. The policy SQL is hand-authored, not
  Prisma-generated, and ships through the migration pipeline — see
  [packages/db/CLAUDE.md](../packages/db/CLAUDE.md), including the FORCE-RLS backfill footgun.
- **Keeping it fresh — two strategies, picked per workload:**
  1. **Reconcile + live-overlay (the workload-A default).** A nightly cron recomputes the
     trailing window from the source-of-truth tables and overwrites the rollup — closed-day
     correctness that heals late refunds, cancellations, and any missed events. The _read_
     endpoint then recomputes the most recent open day(s) live and overlays them on the
     rollup, so "today" is fresh **without any event worker**. Because workload-A data is
     always recomputable from operational tables, this is strictly correct (no drift) and
     cheaper than running a consumer — so it is the default. Reconcile makes closed days
     right; the live overlay makes the open day fresh.
  2. **Incremental event-increment (workload B, or very high write volume).** A Pub/Sub event
     worker bumps the bucket on each business event, e.g. `INSERT … ON CONFLICT
(tenant_id, bucket) DO UPDATE SET … = rollup.… + excluded.…`. Reserved for when there is
     **no source to recompute from** (captured events, §6), or when even a per-day live
     overlay is too heavy at scale. Always pair it with a nightly reconcile as the
     correctness backstop.
- **Backfill:** the reconcile job, run once over full history, is also the backfill — no
  separate tooling.
- **Reference implementation:** `rollup_commerce_daily_revenue` (commerce sales timeseries)
  is the first rollup and the canonical example of the reconcile + live-overlay pattern:
  the table + RLS migration, `reportingService.{revenueTimeseries,reconcileRevenueRollup}`,
  the `/internal/commerce/revenue-rollup` cron endpoint + `commerce-revenue-rollup` CronJob,
  read via `GET /v1/commerce/reports/revenue-timeseries`. Copy it for invoicing collected,
  dropship, and automation-runs timeseries.

Rollups are the home for: commerce sales timeseries & discount performance; invoicing
collected/days-to-pay/customer-breakdown/reminder stats; dropship timeseries & on-time rate;
automation runs timeseries & success rate; CRM leads-by-source & cross-segment/task
aggregates; B2B order-volume/revenue/approvals-over-time; CMS publishing cadence; chat
volume/AI-vs-human/agent-performance; inventory valuation & low-stock summaries.

---

## 6. Event-capture pipeline (workload B)

For metrics with no operational source — chiefly **site analytics** (page views, sessions,
visitors), and later **AI usage** (tokens/tool/cost) and **chat CSAT** — we must capture
events before we can report on them.

**Conventions**

- **Capture table:** `events_<domain>` (e.g. `events_site`, `events_ai`), append-only,
  **native range-partitioned by day**. Columns: `tenant_id`, `occurred_at timestamptz`,
  `type text`, subject keys (e.g. `path`, `session_id`), `props jsonb`.
- **Ingestion:** a lightweight collector endpoint (or the existing event bus) writes raw
  events. Keep it off the operational pool; batch where possible.
- **Retention:** short raw retention (e.g. 30–90 days) enforced by **dropping old partitions**
  (cheap, instant) — never row-by-row deletes.
- **Rollup:** the nightly cron rolls raw events into the same kind of `rollup_*` summary
  tables as §5, which the read endpoints serve. The overview never queries raw events.
- **Graduation:** when raw volume or query latency outgrows partitioned Postgres, export raw
  events to **BigQuery** and run the rollups there (§8.3). The read endpoints don't change —
  they still read `rollup_*`.

Site analytics is the flagship workload-B pipeline and the natural first tenant of BigQuery.

---

## 7. Read endpoints

- **Route:** `GET /v1/<module>/reports/<name>` in `api-rest`, tenant-scoped, behind the
  module gate. Timeseries return `{ range: {from, to, grain}, points: [{ bucket, …measures }] }`;
  breakdowns return `{ rows: [{ key, …measures }] }`.
- **Isolation:** reporting handlers use a **dedicated, capped** Postgres pool (separate from
  the operational pool) with a `statement_timeout` (target ≤ 5s). A slow or runaway report
  degrades only reporting, never checkout.
- **Caching:** cache responses in the in-pod **Redis** keyed by `tenant_id : report : range`,
  short TTL (60–300s). Rollups change at most daily for historical buckets; only the current
  bucket is hot, so even a short TTL is highly effective.
- **Fail-soft:** every endpoint tolerates "no data yet" by returning an empty/partial
  payload — the UI decides whether that's enough to show live or fall back to sample (§9).

---

## 8. Graduation triggers (write them down, spend only when they fire)

Mirrors the Phase-1→2→3 discipline of [03-infrastructure-deployment.md](03-infrastructure-deployment.md) §3.

1. **Cloud SQL read replica** (≈ doubles DB cost) — when Postgres CPU from reporting reads
   measurably degrades operational p95 **and** rollups + caching are no longer enough. Point
   reporting's read pool at the replica.
2. **Dedicated analytics service** — when you want an independent scaling/deploy cadence for
   reporting, or report aggregation contends on the Node side despite rollups. It reads the
   replica; operational `api-rest` is untouched.
3. **BigQuery for raw events** — when workload-B raw volume or query latency outgrows
   partitioned Postgres. Serverless, no idle pods, pay-per-query — fits "cheap until scale"
   better than any always-on store. Rollups move there; read endpoints are unchanged.

Until a trigger fires, the answer is always: a rollup table, an index, and a cache.

---

## 9. "Sample until real" — runtime fallback (not a hardcoded flag)

Today `<SampleBadge>` is a static "this was never wired" marker. As we wire real data we make
it a **runtime** decision per section, so a tenant's dashboard _grows into_ real data and a
brand-new or quiet tenant still sees a populated, non-empty screen instead of a wall of "—".

The rule: **show live data the moment any exists (even a single row); otherwise show sample,
badged.** Implemented by a pure helper in the overview kit:

```ts
// apps/dashboard/app/(dashboard)/_components/overview-bits.tsx
const res = liveOr(liveRows, SAMPLE_ROWS); // arrays: ≥1 row counts as live
// res.data      → live when available, else sample
// res.isSample  → render <SampleBadge reason="no-data" /> only when true
```

- **Arrays** (lists, breakdowns, timeseries) are "live enough" at `length >= min`, default
  **1** — a single real row flips the section to live, per the rule above.
- **Scalars / objects** (a KPI, a summary) are live when non-null.
- **Charts that read poorly with one point** can raise the bar with `liveOr(live, sample,
{ min: 2 })` — a deliberate, per-section choice, not the default.
- **Badge semantics** carry the reason: `reason="no-data"` ("Example data — fills in as you
  get activity") for the runtime fallback, vs. `reason="pending-endpoint"` ("Sample data —
  live once reporting lands") for sections still awaiting an endpoint. Both stay honest.

When a section's endpoint ships, the section moves from a static `<SampleBadge />` to
`liveOr(...)` + `sample={res.isSample}`; the badge then disappears automatically once the
tenant has data.

---

## 10. Per-module home for each missing report

From the gap doc, each missing metric gets a home: 🟢 **wire-now** (endpoint exists today),
📊 **rollup** (§5), 📡 **event-capture** (§6), 🌐 **external-pull** (scheduled ingestion).

| Module               | 🟢 wire-now                                                    | 📊 rollup                                                                      | 📡 event-capture                                                        | 🌐 external-pull                                                         |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Commerce             | top-products, top-customers, inventory-value                   | sales timeseries ✅, discount performance ✅, channel breakdown ✅             | traffic sources (referrer/UTM)                                          | —                                                                        |
| CRM                  | pipeline-funnel, win-loss, top-customers, tasks, segment sizes | leads-by-source ✅, cross-segment ✅, task aggregates ✅                       | —                                                                       | —                                                                        |
| Email                | recent broadcasts, domain SPF/DKIM/DMARC                       | subscriber-growth ✅                                                           | revenue attribution (click→order)                                       | —                                                                        |
| Dropship             | supplier breakdown, per-order margin                           | revenue/orders timeseries ✅, on-time rate, activity                           | —                                                                       | —                                                                        |
| Invoicing            | (aging/docs/workflows already live)                            | collected timeseries ✅, days-to-pay ✅, customer breakdown ✅, reminder stats | —                                                                       | —                                                                        |
| Automations          | per-automation runs list                                       | aggregate runs timeseries ✅, success rate ✅                                  | —                                                                       | —                                                                        |
| Inventory            | location/source counts (live)                                  | valuation, low/out-of-stock, per-location qty, POs, activity                   | —                                                                       | —                                                                        |
| B2B                  | active accounts ✅, quote/invoice/approval counts ✅           | order-volume ✅, revenue ✅                                                    | —                                                                       | —                                                                        |
| CMS                  | published/draft counts ✅, content-by-type ✅                  | publishing cadence ✅                                                          | content views, top content                                              | —                                                                        |
| Chat                 | conversation counts (live)                                     | volume, AI-vs-human, channel mix, agent perf                                   | CSAT                                                                    | —                                                                        |
| Storefront (builder) | blueprint teaser (live)                                        | top pages (from captured events)                                               | **page views, sessions, visitors**                                      | —                                                                        |
| AI                   | —                                                              | usage rollups                                                                  | **MCP/AI calls: tokens, tool, cost** (and build the `/v1/ai/*` surface) | —                                                                        |
| SEO                  | audits (live)                                                  | technical-checklist, activity                                                  | —                                                                       | **Search Console: organic clicks/impressions/CTR/position, top queries** |

---

## 11. Rollout plan (alongside the overview pages)

We wire real data **as we progress through each overview page**, cheapest first:

1. **🟢 Wire-now pass (frontend-only, no backend).** Point the existing-endpoint sections at
   their endpoints with the §9 fallback. Clears a third of the gap with zero infra: Commerce
   (top products/customers, inventory value), CRM (pipeline, win-rate, top customers, tasks,
   segments), Email (broadcasts, domains), Dropship (supplier breakdown, orders).
2. **📊 Timeseries rollups.** The most common gap and what powers the signature charts. Build
   the shared rollup pattern (table + RLS migration + nightly reconcile cron + live-overlay
   read) once, then apply it: commerce revenue **✅ (shipped 2026-06-15 — the reference
   implementation)**, invoicing collected **✅ (shipped 2026-06-15 — `rollup_invoicing_daily_collected`,
   collected-vs-billed)**, dropship orders **✅ (shipped 2026-06-15 — `rollup_dropship_daily_orders`,
   orders/revenue/cost)**, automation runs **✅ (shipped 2026-06-15 — `rollup_automation_daily_runs`,
   runs/success-rate)**. **All four signature timeseries are live.** Each new chart is then a
   small endpoint - a `liveOr(...)` swap.
3. **📊 Remaining operational rollups.** CRM leads/segments/tasks, B2B reporting, inventory
   summaries, chat volume/agent metrics, CMS publishing cadence.
4. **📡 Event-capture surfaces (larger).** Site analytics first (the flagship; BigQuery
   candidate), then AI usage (plus standing up `/v1/ai/*`), then chat CSAT.
5. **🌐 External pulls.** SEO Search Console ingestion; email revenue attribution.

Each section graduates from `<SampleBadge>` to `liveOr(...)` and updates its row in the gap
doc. When the last badge on a page disappears, that overview is done.
