# 130 — Analytics Normalization: one range contract, one scoping model

Version: 1.0.0
Author: Brandon Korous
Last Updated: 2026-07-20

## Purpose

Two breaking changes to the ~60 existing reporting endpoints, to be made **before**
any dashboard is built and **before** there are users:

- **Part A** — one canonical range/grain contract, replacing the current mix of
  `from`/`to`, `days`, `since`, `months` and no-range-at-all.
- **Part B** — site (property) scoping on every report where a per-site figure is
  meaningful, and an explicit tenant-scoped declaration where it is not.

Both are cheap now and expensive later, for the same reason: they are breaking API
changes plus a rollup-key migration. With live tenants, the first needs a
versioning scheme and a deprecation window, and the second needs an online
backfill against tables that are being written to. Today neither is true.

Prerequisite for [129-analytics-dashboards.md](129-analytics-dashboards.md).
Companion to [128-session-attribution.md](128-session-attribution.md), which is
independent and can run in parallel.

---

## 1. Part A — the range contract

### 1.1 The canonical shape

Every reporting endpoint accepts exactly this, and nothing else:

| Param   | Type                       | Rule                                       |
| ------- | -------------------------- | ------------------------------------------ |
| `from`  | ISO-8601 datetime          | Optional. Default per endpoint, documented |
| `to`    | ISO-8601 datetime          | Optional. **Exclusive** upper bound        |
| `grain` | `day` \| `week` \| `month` | Timeseries only. Default `day`             |

Rules that stop the current variance recurring:

- **`from` and `to` are independently optional.** Several endpoints currently
  require _both or neither_ (`commerce/reports/discount-performance`,
  `channel-breakdown`, `channel-revenue`, `crm/reports/leads-by-source`,
  `email/analytics/subscriber-growth`, `scheduling/reports`). A dashboard with a
  single range control cannot honour that inconsistently.
- **`to` is exclusive**, everywhere, matching the existing builder analytics
  (`toExclusive`). Half-open ranges are the only way month boundaries and
  daylight-saving transitions stop producing off-by-one-day bugs.
- **`days`, `since`, `months` are removed** — not aliased. Retained aliases
  become the shape people keep writing, and the variance survives. Affected:
  `email/analytics/overview` (`days`), `crm/reports/win-loss` (`since`),
  `crm/reports/acquisition` (`months`).
- **A scalar/summary endpoint still takes `from`/`to`** even with no grain, so
  the dashboard range applies uniformly. Endpoints with no range today
  (`b2b/reports/summary`, `content/reports/summary`, `crm/reports/snapshot`,
  `crm/reports/tasks`, `inventory/reports/summary`, `invoicing/reports/collections`,
  `seo/reports/checklist`) gain one where the measure is period-bounded, and
  explicitly **do not** where it is a point-in-time snapshot (§1.3).
- **Grain is honoured or rejected, never silently ignored.** Endpoints that
  hardcode a grain today (`crm/reports/acquisition` = month,
  `inventory/reports/valuation-timeseries` = day) either implement the others or
  return a clear error naming what they support. Silently returning daily buckets
  to a caller asking for months is the failure mode that makes a dashboard lie.

### 1.2 One shared validator

A single Zod schema and range-resolver in `api-rest`, imported by every reporting
route — not copied. The current variance exists precisely because each route
declared its own. One definition is the only durable fix; a convention documented
and hand-applied 60 times will drift again within a quarter.

The resolver also owns **default ranges** and **timezone**. Buckets are currently
UTC days (`rollup_*.bucket` is a `date`), which means a tenant in UTC-7 sees
"today" start at 5pm. That is a known, accepted Phase-1 simplification —
recorded here so it is a decision rather than a surprise, and so a future
tenant-timezone change has one place to land.

### 1.3 Period measures vs point-in-time snapshots

A real distinction the current endpoints blur, and the dashboard will expose:

- **Period measures** — revenue, orders, visitors, published entries. Bounded by
  the range. Always take `from`/`to`.
- **Snapshots** — inventory valuation, AR outstanding, open pipeline, stock
  status. These are _as of now_, and applying a date range to them is either
  meaningless or a different question entirely ("what was AR on the 5th"), which
  requires historical rollups most of these do not have.

Snapshot endpoints must declare themselves as such rather than accepting a range
they ignore. The dashboard renders them with an "as of now" affordance instead of
inheriting the range control — otherwise a user sets last month and reasonably
believes they are seeing last month's stock value.

### 1.4 The consumer audit changes the plan

`apps/dashboard` is being **fully removed** when `sparx/apps/workbench` ships as its
replacement. So the question is not how to migrate the reporting endpoints — it
is whether they should exist at all. An audit of every caller:

| Consumer                                 | How it reads reports                                                                                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/dashboard`                         | The HTTP `/reports/*` endpoints — **and it is being deleted**                                                                                                                 |
| `wizeworks/services/api-mcp`             | **Does not call them.** MCP read-tools call `reportingService` directly (`wizeworks/packages/commerce/src/mcp/read-tools.ts`, `wizeworks/packages/crm/src/mcp/read-tools.ts`) |
| `wizeworks/services/api-graphql`         | Calls `reportingService` directly (`routes/crm/resolvers/reports.ts`)                                                                                                         |
| Rollup schedulers                        | Call `reportingService` directly (`wizeworks/packages/commerce/src/schedulers/*`)                                                                                             |
| `wizeworks/apps/site` / `market` / `web` | No consumers                                                                                                                                                                  |
| `sparx/apps/workbench`                   | Two call sites, both builder analytics, both trivially movable                                                                                                                |

**The ~60 reporting HTTP endpoints have effectively one consumer, and it is being
deleted.** Every other integration already reads through the **service layer** —
which is the correct integration point and is already proven by two independent
consumers.

**Revised decision: do not normalize 60 route handlers. Collapse them.**

- The metric registry ([129 §3](129-analytics-dashboards.md)) calls
  `reportingService` **directly**, exactly as MCP read-tools already do — not
  through HTTP, and not wrapping routes that are about to be deleted.
- **Range normalization then happens once**, in the registry, instead of sixty
  times across route handlers. §1.1's contract becomes the registry's internal
  contract rather than a convention hand-applied per route — which was §1.2's
  concern, solved structurally instead of by discipline.
- Routes are deleted alongside the dashboard surfaces that call them.

**The real work this exposes:** some aggregation lives in the _route handler_
rather than in a service — `ai/reports.ts` aggregates `audit_logs` inline,
`b2b/reports.ts` and `builder/analytics.ts` compute in the route or in
`lib/site-analytics-reports.ts`. Deleting those routes would delete working
logic. So the task is **lift route-level aggregation down into the service
layer**, then delete the route. That is a strict improvement regardless of
dashboards: it is what makes a report reachable by MCP and GraphQL too, which
today it is not.

This is less work than normalizing sixty handlers, and it ends with a smaller
surface rather than a uniformly-decorated large one.

## 2. Part B — the scoping model

### 2.1 What is already true

The operational data is **already site-stamped**, which makes this far smaller
than it first appears:

- `Order.property_id` — nullable, `onDelete: SetNull` (deleting a site preserves
  finance history), indexed `(tenantId, propertyId, placedAt DESC)`.
- `Customer.property_id` — nullable, with
  `@@unique([tenantId, propertyId, email])`.
- **18 schema files carry `propertyId`** in total, including CMS content, email,
  products, categories, carts, forms, dropship, legal placements and site
  analytics.

So the dimension is missing **only in the rollup tables and the read endpoints**.
The rollups are recomputable from source, so this is a recompute, not a data
reconstruction.

### 2.2 Not everything is site-scoped, and forcing it would be a silent bug

"Everything is site-based; anything not aligned is legacy" is the right default
and it is **not universally true**. Three classes, decided per subject:

**Site-scoped** — the figure differs per site and the source rows carry the site.
Orders/revenue, customers, content, forms, email sends, carts, traffic, organic
search. These get `property_id`.

**Tenant-scoped by nature** — the underlying resource is genuinely shared, and
splitting it would fabricate a number:

- **Inventory levels.** One physical unit cannot belong to two sites, so
  `property_id` does **not** belong on `InventoryLevel` — stock is held at a
  location, not at a site.

  The Bob's-Parts/Savory-Donuts case (§2.7) shows the reporting need is real —
  flour and machined steel are not one pool — but it also shows the relationship
  is **many-to-many, not one-or-all**: Bob's Parts holds stock in warehouses 1
  and 3, Savory Donuts in warehouses 1 and 2. Warehouse 1 serves both. A nullable
  `Warehouse.property_id` cannot express that and is rejected.

  Two genuinely different questions are being conflated, and they resolve on
  different axes:

  **"What is the donut shop's stock worth?" — the PRODUCT axis, and it already
  works.** `ProductProperty` is an existing many-to-many junction with the
  semantics _empty = visible on all sites, one-or-more rows = only those sites_
  (composite PK, no `tenant_id` — scoping rides the FK parents). Ownership of
  goods follows the product, not the building, so per-site valuation is
  `InventoryLevel → variant → product → propertyLinks` with **no schema change
  at all**.

  Caveat, and it is the §2.5 trap again: a product linked to both sites belongs
  to both, so per-site valuations **do not sum to the tenant total**. This
  measure is `additive: false` across the site dimension for exactly the reason
  visitors are.

  **"Where does the donut shop ship from?" — the WAREHOUSE axis, and it does not
  exist.** `Warehouse` carries no property link, so nothing records which
  locations a business operates out of. This is a fulfilment-routing need rather
  than a valuation one (`defaultForChannel` gestures at it, but channel ≠ site).
  The fix is a **`WarehouseProperty` junction mirroring `ProductProperty`
  exactly** — same composite PK, same no-`tenant_id`, same empty-means-all
  semantics. The user's case is then literally two rows per business, with
  warehouse 1 appearing in both.

  The intersection of the two axes answers what a warehouse manager actually
  asks — _what is in warehouse 1, and whose is it_ — and neither axis alone can.
  **That is the entire list.** Automations, chat and AI usage were initially
  classified here too. All three were wrong (§2.8), and the way they were wrong
  should change the default rather than just the entries.

**The default inverts: everything is site-scoped unless there is a positive
argument otherwise, and the burden of proof is on the exception.** The test is
not _"is the underlying resource shared?"_ — that test produced three wrong
answers in a row. The test is **"does a customer or an operator experience this
as belonging to one business?"** Applied to the Korous case (§2.7), almost
everything does.

Genuinely tenant-level after that test: the tenant record, billing and
subscription (the tenant is who pays), and physical inventory levels — where
ownership still resolves through the product, not the location.

### 2.8 Three corrections, and why they were not reporting problems

Each of these was classified tenant-level on the "shared resource" test and each
turned out to be site-scoped. In all three the reporting gap is the _least_
important consequence — which is why they are recorded rather than quietly fixed.

**Automations — a blast-radius defect.** `Automation` carries `tenant_id` and a
`triggerType` with no site dimension, so an automation with an `order.placed`
trigger fires on **every order in the tenant**, including the other business's.
A quote-follow-up sequence written for a machine shop runs against donut orders.
Its actions reference site-specific things — templates, products, pages — so the
result is not merely noisy, it is wrong, and it is customer-visible. This is a
correctness bug that exists today, independent of dashboards.

**AI/MCP usage — meaning, and isolation.** Aggregate usage across two unrelated
businesses is a number with no action attached to it. Split per site it is a
signal: if Bob's Parts absorbs all the AI activity and Savory Donuts none, the
owner has something to act on. Separately and more seriously, `ApiKey` holds
tenant-wide `scopes` with no site restriction — so an integration built for the
donut shop can read the machine shop's customers and orders. That is an access
question, not an analytics one.

**Chat — routing, not reporting.** `ChatConversation` has no site, so a
conversation started on Bob's Parts cannot be routed away from someone who only
handles donuts, and the AI handler has no site context to answer from. (Related:
`chat/ai-handler.ts:204` was already catalogued as an unscoped reader.)

**Consequence: this doc has outgrown its title, and the overflow has moved.**
Site-scoping turned out to be a platform correctness concern that analytics
merely exposed — a full audit found **282 models of which only 32 carry a site
dimension**, with site-scoping applied to the presentation layer and never
propagated into the operational one.

That work now lives in
**[131-site-scoping-remediation.md](131-site-scoping-remediation.md)**, including
several defects that are live today (automations firing across businesses, API
keys reading across them, staff who cannot be scoped to one site, every email
sending under one identity). None of it is blocked on dashboards and it should
not wait behind them.

This doc keeps what is genuinely analytics: the range contract (§1) and the
rollup keys (§2.4).

**Invoicing — DECIDED: site-scoped.** See §2.7. This is not a reporting
preference; a document that names the wrong business is a customer-facing defect,
and it turned out to be the largest single finding in this doc.

### 2.7 The governing principle: the SITE is the business identity

The case that settles this: one tenant, **Korous Family Inc.**, running two
unrelated businesses — **Bob's Parts** (machined parts) and **Savory Donuts**. A
quote raised on Bob's Parts becomes an invoice that must present as _Bob's Parts_.
Not Savory Donuts, and not Korous Family Inc.

**The tenant is the billing and ownership container. The site is the business a
customer actually deals with.** That single line resolves a long tail of
questions that would otherwise each be argued separately, and it is consistent
with what the platform already does — `Property.name` is the customer-facing
name, `Tenant.name` is legal/ownership only, and email, legal placements, forms
and content are already property-scoped.

Three findings from checking `72-invoicing.prisma` against this case:

**a) Document numbering is tenant-wide, and that is customer-visible.**
`@@unique([tenantId, number])` and `@@unique([tenantId, numberSeq])` mean Bob's
Parts and Savory Donuts **share one sequence**. Bob's customer gets INV-000123,
the next donut invoice is INV-000124, and each business's numbering appears to
skip at random. It also leaks that two unrelated brands are one entity — which a
tenant running separate businesses may have deliberate reasons not to disclose.
Numbering must be scoped per property: `@@unique([tenantId, propertyId, numberSeq])`.

**b) There is no frozen issuer identity on the document.** `billTo` / `shipTo`
are denormalized JSON snapshots specifically so a later customer edit never
rewrites a finalized document. **The issuing side has no equivalent** — it is
resolved at render time. So renaming or re-theming a site retroactively rewrites
the letterhead on every historical invoice it ever issued. The same snapshot
discipline must apply to the issuer: freeze name, address, tax id and mark onto
the document when it is finalized.

**c) The legal entity still belongs on the invoice.** `wizeworks/packages/db/CLAUDE.md`
states `Tenant.name` is "never rendered to a customer or sent in a customer
email." An invoice is the **documented exception** — tax and company-law
requirements generally oblige the legal entity to appear. The rendering is
"Savory Donuts" as the trading identity with "a division of Korous Family Inc."
plus the tax id in the legal block, not one or the other. That carve-out should
be written into the invoicing spec rather than left as a contradiction between
two docs.

Consequently `BillingDocument` gains `property_id`, and
`rollup_invoicing_daily_collected` is unblocked and gains it too. This work is
the natural front half of the **TenantBrand → Property consolidation** already
agreed in principle — `tenant_brands.business_name` is exactly the deprecated
name source this case proves cannot survive.

### 2.3 The null-site footgun

`Order.property_id` is **nullable** by design — the schema comment is explicit:
_"legacy / admin / import / MCP orders may have no site (null = no specific site,
shows under 'All sites')."_

Rollup tables cannot express that naively, because **PostgreSQL primary-key
columns are NOT NULL**. `rollup_site_daily` sidesteps it by only ever rolling up
events that have a property. Commerce cannot.

Three options, and two are wrong:

1. **Nullable `property_id` + a unique index.** ✗ Postgres treats NULLs as
   distinct in unique indexes, so `ON CONFLICT` never matches the no-site row and
   the nightly reconcile **inserts a duplicate every single run**, silently
   double-counting. (PG15's `NULLS NOT DISTINCT` fixes it, but relying on it means
   a subtle correctness property depends on an index modifier nobody will
   remember.)
2. **Backfill null → the primary site.** ✗ Fabricates data. An MCP or imported
   order genuinely did not come from a site, and attributing it to one corrupts
   exactly the per-site comparison this work exists to enable.
3. **A sentinel UUID for "no site"** — the all-zeros UUID
   `00000000-0000-0000-0000-000000000000`, `NOT NULL` in the key. ✓ Upsert-safe,
   PK-legal, and the read maps it back to the **"All sites"** label the schema
   comment already establishes as the convention.

**Decision: option 3.** Defined once as a shared constant, never re-typed.

### 2.4 Rollups to migrate

| Rollup                             | Action                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rollup_commerce_daily_revenue`    | Add `property_id` to PK. Recompute from `orders` — **the highest-value change here**                                                                                                        |
| `rollup_dropship_daily_orders`     | Add `property_id` (dropship carries `propertyId`). Recompute                                                                                                                                |
| `rollup_invoicing_daily_collected` | **Blocked on §2.2's invoicing decision**                                                                                                                                                    |
| `rollup_inventory_daily_valuation` | **No change** — tenant-scoped by nature. Note that this rollup is a _snapshot_ and is explicitly not historically recomputable, so it could not be backfilled per-site even if we wanted to |
| `rollup_automation_daily_runs`     | No change — tenant-scoped                                                                                                                                                                   |
| `rollup_site_daily`                | Already scoped                                                                                                                                                                              |
| `rollup_search_console_daily`      | Already scoped                                                                                                                                                                              |

Backfill runs through the DB Migrate pipeline, never a laptop — the Cloud SQL
instance is private-IP only. Any backfill touching a FORCE-RLS table must loop
tenants and `set_config('app.tenant_id', …)` per tenant; `sparx_owner` is a
non-superuser in prod and sees zero rows otherwise. This passes locally on a
superuser and fails in prod. See [wizeworks/packages/db/CLAUDE.md](../packages/db/CLAUDE.md).

### 2.5 Cross-site aggregates are not always sums

Once figures are per-site, "all sites" is **not** always the sum of the parts:

- Revenue, orders, pageviews, sends — additive. Sum is correct.
- **Visitors and sessions are not.** They are distinct counts, and the same
  person visiting two of a tenant's sites is one visitor, counted twice by a sum.
  `rollup_site_daily`'s own comment already warns about this across _time_; the
  same trap now exists across _sites_.
- Rates and averages — never summed, and only correctly averaged when weighted.

This is what `MetricDefinition.additive` (doc 129 §3) exists for, and the
scoping work is what makes it load-bearing rather than theoretical.

### 2.6 The endpoint surface

Every site-scoped report accepts `?property=<uuid>`, resolving the same way the
builder analytics already does — named property, else the active site from the
`x-sparx-property-id` header, else all sites. That precedent exists and works
(`toBuilderContextFor`); it should be lifted into a shared helper rather than
reimplemented per module.

Two endpoints already scope via the header only and should gain the explicit
param for consistency: `content/reports/top-content` and the `seo/organic/*` set.

## 3. Sequence

1. **Range contract** (Part A) — as the metric registry's internal contract
   (§1.4). Per module: lift any route-level aggregation into the service layer,
   register its metrics, delete the route with the dashboard surface it served.
   No `apps/dashboard` call sites are fixed — that app is being removed.
2. **The invoicing scoping decision** (§2.2) — a conversation, not code, but it
   blocks one rollup migration so it should happen early.
3. **Scoping model** (Part B) — the sentinel constant and shared property
   resolver first, then commerce revenue (the highest-value rollup), then
   dropship.
4. **Then** doc 129's metric registry and batch endpoint land on a uniform
   surface, which is the entire point of doing this first.

Attribution ([128](128-session-attribution.md)) is independent of all of the
above and should run in parallel — it is the only piece whose cost grows with
every day of untagged traffic.

## 4. Why this is not premature

It is deliberately not a rewrite. Aggregation logic, rollup jobs and service
methods are untouched — this changes **parameter parsing** and **one key column
on two rollup tables**. The reason to do it now is not that it is large but that
it is _breaking_: every one of these becomes a versioned API migration with a
deprecation window the moment a tenant depends on it, and the rollup key change
becomes an online backfill against a live write path.
