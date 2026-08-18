# 129 — Analytics Dashboards: the metric model, tiles, and default dashboards

Version: 1.0.0
Author: Brandon Korous
Last Updated: 2026-07-20

## Purpose

How sparx presents business analytics to tenants: the metric layer that feeds it,
the tile contract, the dashboard-as-pane shape in the workbench, and the default
dashboards each module ships with.

**Customization is explicitly deferred** (§9). Dashboards are built as _data_
rather than markup so that user-authored dashboards are a later addition rather
than a rewrite, but no editing UI is in scope. The default dashboards are the
product; the editor is a response to demand that has not arrived yet.

Related: [97-analytics-reporting-architecture.md](97-analytics-reporting-architecture.md)
(how reports are computed), [128-session-attribution.md](128-session-attribution.md)
(joining traffic to money), [123-workbench.md](123-workbench.md) (panes, workspaces).

---

## 1. Correcting the premise

Early discussion assumed the reporting layer barely existed. **That was wrong,
and the correction changes the plan.** An audit of `wizeworks/services/api-rest` found:

- **~60 reporting endpoints across 15 of 18 modules.** Commerce alone has 13.
  Only `storefront`, `finance` and `platform` have none.
- **7 rollup tables** already maintained by the cron fleet:
  `rollup_commerce_daily_revenue`, `rollup_invoicing_daily_collected`,
  `rollup_dropship_daily_orders`, `rollup_automation_daily_runs`,
  `rollup_inventory_daily_valuation`, `rollup_site_daily`,
  `rollup_search_console_daily`.

So this is **not** a from-scratch analytics build. The measures largely exist.
What is missing is everything _between_ those endpoints and a dashboard — and
that is a much smaller, more tractable problem than building reporting itself.

## 2. The four real gaps

**2.1 — No batching.** ~60 individual endpoints, one HTTP request each. A single
dashboard of eight tiles is eight requests; four dashboards open across two
displays is 32, repeating. Batching is mandatory, not an optimization (§5).

**2.2 — Inconsistent range vocabulary.** Endpoints variously take `from`/`to`,
`from`+`to` _both required_, `days`, `since`, `months`, or no range at all.
Grain support is equally uneven — some accept `day|week|month`, some hardcode
month, several offer none. **A dashboard has one date range that every tile
obeys**, and today that cannot be expressed uniformly.

**2.3 — Most reads are LIVE against operational tables**, and doc 97 §7's
isolation plan is **aspirational, not implemented**: there is no separate
reporting pool, no `statement_timeout`, and no response caching anywhere in
`api-rest`. Dashboards multiply reporting load by exactly the factor that makes
this dangerous, so the isolation doc 97 already specified must ship _with_ them.

**2.4 — Property scoping barely exists.** Only `rollup_site_daily` and
`rollup_search_console_daily` carry a `property_id`. Every other rollup is keyed
`(tenant_id, bucket)`. See §7 — this has a direct product consequence.

## 3. Decision: a metric registry as a façade, not a rewrite

One registry entry per metric, declaring what a dashboard needs to know to render
and query it safely. It **delegates to the existing endpoint or service** — it
does not reimplement aggregation.

```ts
interface MetricDefinition {
  id: string; // stable forever — see §4
  module: WorkbenchModule; // gates visibility; hidden when module is off
  label: string; // plain English, business-owner vocabulary
  unit: 'currency' | 'count' | 'percent' | 'duration' | 'ratio';
  grains: readonly Grain[]; // which of day|week|month this supports
  additive: boolean; // FALSE for distinct counts — see below
  scope: 'tenant' | 'property'; // whether a per-site figure is meaningful
  resolve(ctx: MetricContext): Promise<MetricResult>;
}
```

`additive` is the field that prevents a whole class of silent wrongness.
`rollup_site_daily.visitors` is a per-day distinct count: charting it per bucket
is correct, summing it across a window is **wrong and looks right**. A metric
declaring `additive: false` cannot be summed by the query layer — a window total
must come from the metric's own windowed resolver or not be offered at all.

**`resolve()` calls the SERVICE layer, not the HTTP endpoints.** MCP read-tools
and the GraphQL resolvers already read `reportingService` directly; the ~60
reporting routes exist almost solely for `apps/dashboard`, which is being
removed. So the registry integrates where every other consumer already does, and
the routes are deleted rather than wrapped. See
[130 §1.4](130-analytics-normalization.md).

Why a façade over the services rather than a new pipeline: the measures are
computed and correct today. The value is in making them _uniformly addressable_,
not in recomputing them.

**What the registry does normalize** — the range vocabulary. Every metric
resolver receives one canonical `{from, to, grain}` and is responsible for
translating it into whatever its underlying endpoint wants (`days`, `since`,
`months`, both-required `from`+`to`). That translation happens **once per
metric**, not in every tile.

## 4. Decision: metric IDs are permanent

Format `<module>.<subject>.<measure>` — `commerce.revenue.net`,
`builder.traffic.visitors`, `invoicing.ar.outstanding`.

These become the vocabulary user-authored dashboards will reference. Renaming one
later breaks every saved dashboard that used it. They are therefore treated as a
public contract from the first commit: **add and deprecate, never rename.**

## 5. Decision: one request per dashboard

```
POST /v1/analytics/query
{
  "range": { "from": "…", "to": "…", "grain": "day" },
  "property": "<uuid>|null",
  "metrics": [
    { "key": "rev",   "metric": "commerce.revenue.net",     "shape": "timeseries" },
    { "key": "orders","metric": "commerce.orders.count",    "shape": "scalar" },
    { "key": "src",   "metric": "commerce.revenue.by_source","shape": "breakdown", "limit": 5 }
  ]
}
```

`POST` because the request body is a query, not an addressable resource — and
a dashboard's metric list overruns a querystring quickly.

Rules the endpoint enforces:

- **Partial success.** Each result carries its own status. One failing metric
  renders one broken tile, never an empty dashboard. This is the single most
  important property of the design.
- **Module gating per metric**, so a request naming a disabled module's metric
  gets `unavailable` for that key rather than a 403 for the whole dashboard.
- **A hard cap on metrics per request** (start at 24) so a malformed or hostile
  request cannot fan out unbounded.
- **Resolvers run concurrently**, bounded, on the isolated reporting pool from
  §2.3 with a statement timeout. A slow report degrades reporting only — never
  checkout.
- **Cached in Redis** keyed by `tenant : property : metric : range`, short TTL.
  Historical buckets are immutable; only the open bucket is hot, so even a
  60–300s TTL is highly effective — and four dashboards showing overlapping
  ranges share cache entries rather than multiplying load.

**Background panes do not poll.** A dashboard in an unfocused tab group is not
visible and must not refetch. On an ultrawide with several dashboards open this
is the difference between a live workspace and a self-inflicted load test.

## 6. Decision: tiles are declarative, and they click through

A dashboard is a config object — a list of tile specs rendered by one generic
renderer. **No dashboard is a hand-written component with tiles in its markup.**
This is the whole of what "build it as if it might be customized" means in
practice; everything else about customization is deferred.

```ts
interface TileSpec {
  metric: string; // a registry id
  shape: 'scalar' | 'timeseries' | 'breakdown' | 'list';
  title: string; // the QUESTION, not the metric name
  compare?: 'previous_period'; // a number with no baseline is not an answer
  span?: 1 | 2 | 3; // grid columns at the widest container size
  drill?: { surface: string; params?: Record<string, string> };
}
```

**`drill` is the differentiating feature.** Every other analytics product ends
at a number. In the workbench a tile opens the pane that number came from, with
the same modifier contract as every list in the app — click opens a tab,
shift-click puts it alongside the dashboard, alt-click sends it to the second
display. "12 unpaid" becomes the invoice list already filtered.

That makes a dashboard the **front door of the app** rather than a weekly report,
and it is the strongest reason the defaults must be excellent: they become how
people navigate.

**Tiles are titled with the question they answer**, in the vocabulary of a
non-technical owner — "Where buyers came from", not "Revenue by attribution
source". If a tile's question cannot be written in plain English, it does not
belong on a default dashboard.

**Empty and zero states are designed first.** A new tenant's dashboard is all
zeros, and that is the state most likely to be seen by someone deciding whether
to stay. A tile with no data says what will make data appear.

## 7. Decision: per-site dashboards, with an honest limitation

Multi-site comparison was identified as a differentiator — a tenant with three
sites seeing them side by side, where a competitor wants three subscriptions.
**Only half of that is currently possible, and the doc records why.**

Traffic and organic search are property-scoped (`rollup_site_daily`,
`rollup_search_console_daily`). **Revenue is not** —
`rollup_commerce_daily_revenue` is keyed `(tenant_id, bucket)` with no property
dimension, as are invoicing, dropship, inventory and automations. So "compare my
three sites' revenue" cannot be answered today at any speed.

Decision: **`MetricDefinition.scope` makes this explicit rather than silent.** A
dashboard opened for a specific site renders `scope: 'property'` metrics scoped
and shows `scope: 'tenant'` metrics with a clear "across your whole business"
label. A tenant-scoped number silently presented as a per-site figure is the
worst outcome and is what happens if this is not modelled.

**Correction (verified against the schema): the operational data is already
site-stamped.** `Order` carries a nullable `property_id`, indexed
`(tenantId, propertyId, placedAt DESC)`, with `onDelete: SetNull` so deleting a
site preserves its finance history. `Customer` carries one too, and 18 schema
files carry `propertyId` in total. So the missing dimension is **only in the
rollups and the read endpoints** — not in the source data, and the rollups are
recomputable from source.

That makes per-site revenue a tractable migration rather than a rewrite, and it
is promoted into the immediate work. Full plan in
[130-analytics-normalization.md](130-analytics-normalization.md).

## 8. Default dashboards

Seeded when a module activates, addressed by a built-in slug (§9). Each is one
screen answering the questions an owner actually asks.

**Business** — the cross-module default, present for every tenant regardless of
which modules are on. Tiles render only where their module is active, so a
CMS-only publisher and a B2B distributor both get a coherent screen.
Money in · what it came from · what needs attention · what happened today.

**Sales** (commerce) — _Is business up or down_ (net revenue vs previous period,
`rollup_commerce_daily_revenue`) · _How many orders_ · _What's selling_
(top-products) · _Where buyers came from_ (**blocked on
[128](128-session-attribution.md)**) · _What needs doing_ (unpaid / to-send,
drilling into the orders pane).

**Traffic** (builder) — Visitors and pageviews over time · Where visits came from
· Most-read pages · Site speed (vitals). All five endpoints exist and are
property-scoped; **this is the most complete default we can ship today.**

**Customers** (crm) — New customers over time (`acquisition`) · Where they came
from (`leads-by-source`) · Pipeline (`pipeline-funnel`) · What needs doing
(`tasks`, drilling into the task list).

**Money** (invoicing) — Collected over time (`collected-timeseries`, rollup) ·
Outstanding and overdue with aging · Who owes the most (`customer-breakdown`,
drilling to the customer) · Average days to pay.

**Content** (cms) — Published over time (`cadence`) · Most-read content
(`top-content`) · What's scheduled · Draft backlog.

**Stock** (inventory) — Value over time (rollup) · What's out or low, drilling
into the product · Reorder suggestions · Turnover.

Later, from existing endpoints: **Email**, **Wholesale** (b2b), **Support**
(chat), **Bookings** (scheduling), **Search** (seo organic), **Suppliers**
(dropship), **AI**.

Templates are **seeds, not bindings** — applied once at module activation, then
independent, the same way the builder stamps catalog components rather than
linking them. A live template that rearranges a screen when a module is enabled
is the hostile version.

## 9. What is deferred, and the seams it lands on

**Deferred:** dashboard creation, tile add/remove/reorder, per-tile
configuration, a definition API, sharing and permissions.

Shipping without these is a deliberate quality decision, not only a scope one:
when users can rearrange, there is always an excuse for a weak default. Removing
that excuse is the point.

The seams that make it a later addition rather than a rewrite:

1. **Dashboards are data.** Defaults are config objects living in the repo. User
   dashboards move the same shape into a table.
2. **Dashboards are addressable entities** — `analytics.dashboard.view` with
   `{id}`, where `id` is initially a built-in slug (`'sales'`, `'business'`).
   User dashboards are UUIDs in the same slot, so the pane, its descriptor, the
   persisted layout and saved workspaces need no change at all.
3. **A dashboard list surface** — `analytics.dashboards.list` — exists from day
   one, listing the built-ins. It becomes the manager unchanged.
4. **Metric ids are permanent** (§4), so dashboards saved against v1 still
   resolve later.
5. **Definitions belong on the server when they arrive** — tenant-scoped with
   RLS, because "which numbers I care about" should follow a user to another
   device, unlike pane arrangement which is deliberately per-device localStorage
   ([123](123-workbench.md)). The pane descriptor stores only the id, so this
   split costs nothing.

Deliberately **not** built now: a general "any metric × any visualization"
contract. Declarative is cheap; fully general _is_ the customization engine
without a UI. The tile contract stays exactly as flexible as the defaults need.

## 10. Sequence

1. **Reporting isolation** (doc 97 §7) — dedicated capped pool, statement
   timeout, Redis caching. This precedes dashboards because dashboards are what
   make its absence dangerous.
2. **Metric registry + `POST /v1/analytics/query`**, with 6–8 metrics covering
   the Traffic default end to end.
3. **The dashboard pane and tile renderer** — scalar, timeseries, breakdown,
   list, with `drill` and designed empty states. Ship **Traffic** first: it is
   the most complete data we have and the only fully property-scoped set.
4. **Business, Sales, Money, Customers**, adding metrics per dashboard.
5. **Session attribution** ([128](128-session-attribution.md)) unlocks _"where
   buyers came from"_ on Sales and Business. Independent of everything above,
   and time-sensitive — start it in parallel.
6. **Property-scoped revenue** (§7) unlocks true multi-site comparison.
7. **Customization** — only on real, repeated demand.

## 11. Open questions

- Does the **Business** dashboard replace `workbench.home` as the opening pane?
  Current position: **no.** Home teaches that panels are yours to arrange, and
  that lesson is worth more on first run than a screen of zeros. Revisit once a
  tenant has data — an opening pane that is excellent on day 90 and empty on day
  1 is the wrong trade.
- Is there a **role** axis as well as a module axis? An owner asks "how are we
  doing"; a fulfilment operator asks "what do I do next". Both are served by
  drill-through for now; a separate default set is a real possibility later.
- Do dashboards need **export** (CSV/PDF)? Several report endpoints already
  support `?format=csv`, so the plumbing partly exists.
