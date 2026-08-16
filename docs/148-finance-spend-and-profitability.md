# 148 — Finance: spend, profitability, and the accounting handoff

Version: 0.9 (run)
Author: Brandon Korous
Last Updated: 2026-08-16

> Status: **built end to end.** Schema + migration, [`@sparx/finance`](../packages/finance/)
> (85 pure-unit tests plus a DB-backed integration suite), the whole `/v1/finance/*`
> spend API, the finance worker, the CSV connector, **all nine workbench panes**, the
> marketing-site entry, and — new in 0.4 — the **`/finance` landing page** itself.
> See §10 for what each step actually shipped, **§11 for the two production bugs
> that made all of it inert until 2026-08-13**, and **§12 for the three more that
> clicking the repaired path turned up**.
>
> **The activation gate is verified as of 0.6.** `finance` was missing from
> `MODULE_SLUGS` in
> [module-toggle.ts](../services/api-rest/src/lib/module-toggle.ts) — that gate is
> what makes activation possible at all, and a missing slug fails as "Request
> validation failed" rather than as a build error. Both `finance` and `staff` are
> now in the list, the Modules screen renders Finance with the right hue, copy and
> "Included with Online store", and a real toggle round-trip through
> `PATCH /v1/tenant/modules/:slug` answers 200. One caveat on the evidence: the
> round-trip was clicked on `email`, because on every dev tenant finance is
> BUNDLED via Commerce or B2B and its switch is therefore locked. The standalone
> finance toggle — a tenant with neither — has still not been clicked by a human.
>
> Pricing changed in 0.3: **$29/month standalone, and free with Commerce or B2B**
> (§2). A tenant already selling through sparx has bought the revenue half of its
> P&L, and charging again for the subtrahend prices out exactly the small
> businesses this platform is for.
>
> This turns the former read-only Finance surface group into a real module: the
> money-in views stay free and unchanged, and a new billable half records what the
> business SPENDS and nets the two into a profit figure per site, per period, per job.

---

## 1. What this is (and is not)

**Is:** spend tracking and profitability for any business on the platform — a repair
shop, a bakery, a consultancy, a publisher with no store at all. Record what you paid
and who you paid it to, tie it to the job it was for when there is one, and get a
straight answer to "did we make money" that already knows what came in.

**Is not — and this is a permanent product position, not a v1 boundary:** bookkeeping.
No general ledger. No double entry. No chart of accounts. No bank feeds or
reconciliation. No trial balance. No tax filing. No payroll runs.

### Why the boundary is permanent

Accounting software is years of work whose real product is **trust**, and trust in this
category is already spent: it is QuickBooks or Sage 50 (Peachtree), and a small business
is right not to hand its books to a new platform. Competing there means spending a
decade to arrive second. Worse, it means becoming a tax filer in fifty states the day
anyone asks for payroll.

So sparx takes the position that is actually defensible: **we know things their
accounting package does not.** We know which job the part was for, which technician's
hours went into it, which site sold it, what it cost to acquire the customer who
bought it. Their books know none of that and never will, because the data never
reaches them at that grain. We answer the operational question — _is this work
profitable_ — and hand the accountant a clean, mapped export for the statutory one.

That framing also decides every ambiguous call downstream. When a feature request
sounds like accounting, the test is: **does it help the owner run the business today,
or does it help someone file something?** The first is ours. The second is an export.

### Locked decisions

1. **Never compete with QuickBooks / Sage 50 / Xero.** Integrate, export, import,
   map — never replace. Any PR that starts building a ledger engine is out of scope by
   construction, and the connectors are a first-class deliverable rather than a
   checkbox (§6).
2. **Stock purchases are NOT expenses.** A purchase order converts cash into inventory
   _value_; that value becomes cost only when the goods sell, which
   `inventory_movements.cost_consumed_cents` already records. Writing POs into the
   expense ledger double-counts every part — once on receipt, again as COGS on sale.
   This is the single most likely way to ship a wrong number, so it is a locked
   decision, a comment in the schema, and a test — not a code review note.
3. **The platform never copies a number it already owns.** COGS and fees are _read_ by
   the profit rollup from the inventory and order tables. The expense ledger holds only
   what has no other home. Two sources of truth for one number is how a report starts
   disagreeing with the screen it links to.
4. **Site-scoped by default.** Expenses belong to a business, not a billing container
   (docs/131 §4). Nullable `property_id` exists for the genuinely tenant-level cost —
   the sparx bill covers every site — and null renders as its own bucket, never folded
   silently into a site's numbers.
5. **The money-in half stays free.** Payments, Payouts, Owed to you, Where money comes
   from and Your sparx bill are a view of data the tenant already paid for through
   commerce / invoicing / b2b. Charging to look at your own takings is a tax on data
   they already bought. Only the spend + profitability half is billable (§2).
6. **Two dates, never one.** `incurred_at` is the period the cost belongs to and is
   what profit buckets on; `paid_at` is when money left. Bucketing profit on payment
   date makes a business that pays suppliers on the 1st report a catastrophic month,
   every month.

---

## 2. Module wiring and price

`finance` is registered in the `ModuleSlug` union and `ALL_MODULES`
([packages/modules/src/index.ts](../packages/modules/src/index.ts)) and priced at
`finance: 2900` in `MODULE_MONTHLY_CENTS`
([packages/billing/src/price-catalog.ts](../packages/billing/src/price-catalog.ts)).

**$29/month standalone, and free with Commerce or B2B.** Same tier as inventory,
dropship and scheduling. Two reasons for that number specifically:

- It is the first module in the catalog that is valuable to **every** tenant regardless
  of what else they run. A CMS-only publisher pays rent and contractors; a CRM-only
  team buys software and travel. That makes it the broadest attach we have, and broad
  attach argues for a price that is never the reason someone says no.
- It carries real ongoing cost — receipt storage, the recurring-expense generator, the
  nightly profit rollup, and connector sync traffic against a third-party API.

**`BUNDLED_FREE: ['commerce', 'b2b']`, no `REQUIRES`.** This module has the unusual
property of being both genuinely standalone _and_ obviously bundled, depending on who
is asking:

- A tenant **already selling** through sparx has bought the revenue half of its P&L.
  Profit is revenue minus spend — selling the subtrahend as a separate line item is
  charging twice for one number, and it prices out exactly the small businesses this
  platform is for. Commerce and B2B therefore include it, at $0, the same way they
  already include invoicing and inventory.
- A tenant with **neither** — a consultancy, a nonprofit, a landlord, a publisher —
  has no revenue module to bundle it into, and for them spend tracking is the whole
  product rather than the other half of one. They pay the $29 standalone price.

That is the same shape as `invoicing` and `inventory`, and it falls out of the existing
graph for free: bundling takes precedence over a standalone purchase in
`deriveModuleStates`, so a consultancy that bought `finance` and later turns on Commerce
stops being billed for it, and the flag is preserved rather than cleared so turning
Commerce back off resumes the standalone charge.

No `REQUIRES`, and that part still matters: nothing about expense tracking needs another
module to be meaningful, which is what lets it be the entry point for a business that
arrives with no site and no store.

### The gate: why it had to be per-surface — RESOLVED

Before this module existed, `finance` was a workbench module _identity_ only, and its
five surfaces shipped ungated to everyone. The reason turned out to be a specific line
in `moduleIsVisible`:

```ts
if (!known.has(module)) return true; // a module the server never heard of SHOWS
```

`known` is built from the `ModuleSlug` set, so registering the slug would have flipped
those five surfaces from "always visible" to "hidden unless purchased" — taking four
shipping surfaces away from every tenant that had not bought the new module.

The fix is `SurfaceDefinition.requiresModules` plus a shared `surfaceIsVisible`: the
gate now runs **per surface**, and a module group empties (and disappears) only when
nothing inside it survives. One colored group, three entitlement answers — see §5.

`surfaceIsVisible` is shared by the rail, the mobile drawer, the launcher and
record-search routing. That last one mattered: the launcher had a second gate whose own
comment claimed it used "the same visibility gate the surfaces use", and it would have
routed a search hit straight into a gated surface.

---

## 3. Data model

Ten tables, all `finance_*` except the rollup, which joins the existing `rollup_*`
family. Full commentary lives in the schema; the shape:

| Model                         | What it holds                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `FinanceExpenseCategory`      | The owner's words — Wages, Parts, Rent. `kind` (cost_of_sale \| labor \| operating)  |
| `FinanceVendor`               | Who got paid. FK-less links to `Supplier` / `Company` so finance runs with those off |
| `FinanceExpense`              | The spine. Amount, two dates, category, vendor, site, provenance, export state       |
| `FinanceExpenseAllocation`    | Which job the money was for. One mechanism; the remainder is overhead                |
| `FinanceExpenseAttachment`    | Receipts, as `MediaAsset` rows — the platform's one upload path                      |
| `FinanceRecurringExpense`     | Rent, insurance, software. Generated by the worker, idempotently                     |
| `FinanceAccountingConnection` | The tenant's own OAuth grant to QuickBooks / Xero / Sage 50 (§6)                     |
| `FinanceAccountingMapping`    | sparx category ↔ their account. Loosely keyed so the mappable set can grow           |
| `FinanceAccountingSyncRun`    | What happened last sync, including WHICH records bounced                             |
| `RollupFinanceDailyProfit`    | The subtraction, cached per (tenant, site, day). Safe to truncate and recompute      |

Three decisions in there are worth surfacing because they will look wrong at a glance:

**Categories are not a chart of accounts.** A non-technical owner does not have one and
will not build one; picking "6420 · Repairs & Maintenance" from a list of 180 is how the
feature goes unused by week two. `kind` is the only accounting-shaped column, it has
three values, and every seeded category ships with it already correct.

**Allocation is the only way to attach spend to a job — there is deliberately no
`order_id` column on the expense for "the simple case."** A second path is how half the
spend ends up invisible to the report that joins the other one. The service layer writes
a single allocation row when the owner picks one job, so the common case stays one
click, and the messy case (one fuel bill across three jobs) works with no new concept.

**`amount_cents` is signed.** A vendor credit or a returned tool is negative spend.
Forcing it positive means inventing a "credit" record that every report then has to
remember to subtract; one signed column sums correctly with no special cases.

---

## 4. Where the money already is

The reason this module is worth building here rather than buying a spend tracker: on
the day a tenant switches it on, a large part of the answer is already in the database.

| Number                   | Where it lives today                                                | How finance uses it                    |
| ------------------------ | ------------------------------------------------------------------- | -------------------------------------- |
| Revenue, net refunds     | `rollup_commerce_daily_revenue`, `rollup_invoicing_daily_collected` | Read by the rollup. Never re-derived   |
| Cost of goods sold       | `inventory_movements.cost_consumed_cents` (signed; landed cost)     | Read by the rollup. **Never** copied   |
| Dropship supplier cost   | The dropship order's supplier cost                                  | Read by the rollup as COGS             |
| Channel/marketplace fees | `orders.channel_fee_cents`                                          | Read by the rollup as `fee_cents`      |
| Processor fees           | **Nowhere — not captured today.** See the note below                | Not in `fee_cents` yet                 |
| The sparx bill           | The tenant's own subscription                                       | **Derived** into an expense, monthly   |
| Labour                   | Nothing yet — see [149](149-staff-management.md)                    | Derived once staff ships; manual until |
| Everything else          | Nowhere                                                             | Typed, recurring, or imported          |

Note how little is derived into the ledger: the sparx bill, and later labour. That is
decision #3 doing its job. Everything the platform already values stays where it is
valued, and the rollup does the arithmetic at read time.

**Two corrections found while building this**, recorded because the original table
above claimed otherwise:

- COGS comes from **`inventory_movements.cost_consumed_cents`**, not from
  `inventory_cost_consumption`. The movement column is signed and is documented at
  source as "summing the column over a period gives period COGS with no special
  cases" — a reversal carries a negative cost, so a cancelled order credits back for
  free. `inventory_cost_consumption` is layer-level detail underneath it, and has no
  site or day attribution of its own. Site attribution goes through the movement's
  order reference; a movement with no order (a loss, a damage, a manual correction)
  genuinely belongs to no site and lands in the unattributed bucket.
- **Payment-processor fees are not captured anywhere in the platform.** There is no
  fee column on the payment tables; `orders.channel_fee_cents` is the only fee that
  exists. So `fee_cents` currently means _channel fees only_, and the rollup says so
  in a comment. When processor fees land they go into the **rollup**, not the expense
  ledger — filing them as expenses would double-count against this column.

Deriver idempotency is enforced by the DB, not by care: `(tenant_id, source_type,
source_id)` is unique on `finance_expenses`, so re-running a deriver or replaying an
event updates the row instead of doubling the month.

---

## 5. Surfaces

The Finance group splits into two sections that are already visually separated in
[catalog/finance.ts](../apps/workbench/lib/surfaces/catalog/finance.ts). The existing
"Money coming in" and "What you pay sparx" sections are untouched and ungated. New,
behind the module flag:

**Money going out**

- **Spending** — the expense list. Filter by period, site, category, vendor, paid state.
  Bulk categorise. This is the surface people live in, so entry has to be seconds:
  amount, what for, category, done.
- **Expense** (detail pane) — the full row, allocations, receipts, and the audit of what
  derived it if it was not typed.
- **Bills to pay** — unpaid expenses by due date. The exact mirror of the shipping
  "Owed to you" surface, and the pairing is the point: one screen for each direction.
- **Recurring** — the templates, next run dates, and what they will generate.
- **Vendors** — who you pay, with spend-to-date and a link through to the supplier or
  company record when those modules are on.

**Did we make money**

- **Profit** — revenue, cost of sale, labour, operating, net. Per period, per site, with
  the period comparison. The headline surface of the module.
- **Job profitability** — orders and bookings ranked by margin, with the cost breakdown
  that produced each. This is the screen that justifies the price.

**Settings**

- **Categories** — the owner's vocabulary, and the `kind` each rolls up under.
- **Accounting** — the connection, the mapping table, and the sync history (§6).

Design notes that are binding here rather than optional: the profit surfaces are a
**color** problem before they are a chart problem — cost of sale, labour and operating
must be distinguishable at a glance, and a negative month has to read as negative
without the reader parsing a minus sign. `statusTone()` covers paid/overdue/unpaid on
the bills surface. See [DESIGN.md](../DESIGN.md) and RULE #4 before building any of it;
a monochrome P&L is a failed P&L.

---

## 6. The accounting handoff

This is the part that has to be genuinely good, because it is the whole product
position. "We integrate with QuickBooks" usually turns out to mean a CSV with the wrong
column order, and an export nobody can import is the same as no export.

### Providers, and what each direction means

| Provider            | Connect        | Export (sparx →)                        | Import (→ sparx)                 |
| ------------------- | -------------- | --------------------------------------- | -------------------------------- |
| QuickBooks Online   | OAuth 2        | Expenses, invoices, payments, vendors   | Chart of accounts, vendors       |
| Xero                | OAuth 2        | Expenses, invoices, payments, vendors   | Chart of accounts, vendors       |
| QuickBooks Desktop  | File (IIF/CSV) | Expenses, invoices as an IIF batch      | Chart of accounts from an export |
| Sage 50 (Peachtree) | File (CSV)     | Expenses, invoices in its import layout | Chart of accounts from an export |
| FreshBooks          | OAuth 2        | Expenses, invoices, payments            | Accounts, vendors                |
| Wave                | OAuth 2        | Expenses, invoices, payments            | Accounts, vendors                |
| CSV                 | None           | Everything, on the tenant's column map  | Bank/card statements, expenses   |

`csv` is a **real provider row**, not the absence of one — it stores the tenant's column
mapping and delimiter choices so a manual export is repeatable and a bank statement
import remembers its layout. The desktop products are file-based because that is how
they actually integrate; pretending otherwise is how the feature gets described as
supported and behaves as absent.

### Three rules that decide whether an accountant trusts it

1. **Never write into a closed period.** `sync_from_date` is set at connect time to the
   tenant's "books closed through" date and nothing dated before it is ever sent.
   Pushing entries into a closed month is the single fastest way to lose an accountant
   permanently.
2. **Map before you sync.** The first thing a new connection does is _import_ the chart
   of accounts and vendor list, so the mapping screen offers their real accounts instead
   of a free-text box. A sync cannot run with unmapped categories.
3. **`partial` is a real outcome.** The failure that matters is 3 records out of 140,
   and the owner needs to see which three and why. `FinanceAccountingSyncRun.failures`
   holds them; the counts let the UI say "137 sent, 3 need attention" without opening
   the JSON.

Default cadence is **manual**. A cautious first month pressing the button themselves is
exactly the right shape for this feature, and daily/weekly is opt-in once they trust it.

### Registry note for whoever writes the first adapter

`IntegrationCategory` in [packages/integrations/src/types.ts](../packages/integrations/src/types.ts)
does **not** carry an `accounting` member today, and that is correct by that file's own
rule: a category is added the day a live adapter dispatches it, not the day one is
planned. Two categories were previously deleted for being listed with nothing behind
them, and the panel rendered empty headings for months as a result. **Add `accounting`
in the same PR as the first adapter, not in the schema PR.**

---

## 7. Events

Topic name == event type, per the platform convention:

- `finance.expense.recorded` — a spend row committed, however it got there. The rollup
  worker's invalidation trigger. **Published as of 0.7** by the expense routes on create,
  correct and delete; a correction that moves `incurredAt` publishes for BOTH days,
  because the one it left is stale too.
- `finance.expense.allocated` — allocation changed; job profitability is stale. Not
  published separately: allocations only arrive through create/patch, and the worker
  treats the two names identically, so `recorded` already covers it.
- `finance.recurring.due` — the generator's tick. **Published as of 0.7** by
  `finance-recurring-due` (05:30 UTC).
- `finance.profit.recompute` — refresh a window of the daily cache. **Published as of
  0.7** by `finance-profit-rollup` (06:45 UTC).
- `finance.accounting.sync.completed` — carries the run outcome; drives the notification
  when a sync came back `partial` or `failed`. **Still unpublished and unconsumed** — it
  has an `EventType` entry and a provisioned Terraform topic and nothing else. It is
  deliberately absent from the workbench's `TRIGGER_EVENTS` catalog for that reason: a
  trigger that can never fire is worse than one that is missing.

Add each to the `EventType` union in
[packages/events/src/types.ts](../packages/events/src/types.ts).

## 8. Worker

A `finance-worker` **package** exporting `createSubscription(logger)`, running inside
`services/event-worker` — not a new Deployment. Twelve separate worker Deployments were
an inheritance that cost 37% of a node's memory to do 14 millicores of work
([services/CLAUDE.md](../services/CLAUDE.md)); a new handler is a package.

Three jobs: generate due recurring expenses, recompute dirty days of
`rollup_finance_daily_profit`, and run scheduled accounting syncs. The JetStream
`durable` name is permanent once shipped.

## 9. Not in v1, and why

- **Budgets vs. actuals.** A budget is meaningless until there is a year of actuals to
  set it from, and shipping an empty budget screen teaches people the module is empty.
  Revisit once real tenants have history.
- **Receipt OCR.** Genuinely wanted, and it is a BYOK/`ai`-module feature when it lands
  (no platform AI credential, ever — see the BYOK stance). Manual entry has to be fast
  enough that OCR is a nicety, not the thing that makes the module usable.
- **Multi-entity consolidation.** Per-site rollup covers the real case (one owner,
  several businesses). True inter-company accounting is bookkeeping.
- **Cash-flow forecasting.** Needs recurring + payables + receivables to all have real
  data first. Natural second release, and it is the strongest follow-on.

## 10. Build plan

1. ~~**Schema + migration**~~ — **done.** Applied locally; RLS audit passes over all
   ten tables; `NULLS NOT DISTINCT` verified on the two nullable-property grains.
2. ~~**`@sparx/finance` package**~~ — **done.** Service layer, the 19 seeded
   categories, the allocation guard, recurring generation, and the profit rollup.
   `ModuleSlug` + price catalog + the per-surface gate landed with it, per §2.
   59 tests: 30 pure-arithmetic units, 29 integration against real Postgres
   (`test/integration/`, excluded under `CI=true` like every other DB-backed suite).
3. ~~**api-rest endpoints**~~ — **done.** The whole `/v1/finance/*` spend surface,
   registered alongside the existing money-in groups in one `financeRoutes` plugin,
   plus `financeErrorMapper` (over-allocation → 422; the category guards → 409).
4. ~~**Workbench surfaces**~~ — **done.** All nine panes in §5, registered in
   [catalog/finance.ts](../apps/workbench/lib/surfaces/catalog/finance.ts) and each
   with an address in [packages/links/src/routes.ts](../packages/links/src/routes.ts)
   (`check:routes` enforces it). Shared by all of them:
   `spend-data.ts` (every hook + type on one cache root, so the list, the bills
   screen and the profit figure cannot disagree for a render), `period.ts` (one
   definition of "this month" across four surfaces), and the `format.ts` spend
   vocabulary — `kindColor` in particular, which is the ONLY place the three cost
   hues are chosen.

   Two decisions inside them worth carrying forward. **Quick entry is inline on
   the Spending list**, not a trip to the detail pane: amount / what for /
   category, Enter to save, focus back to the amount and the category deliberately
   sticky — a shoebox of receipts is a run of the same kind of thing. And **the
   Profit surface leads with color**: net profit is red when negative before the
   reader parses a minus sign, and the per-day chart colors each bar by its own
   sign rather than hanging negatives below an axis line someone has to find.

   A second pass caught the Accounting surface shipping two of its three parts —
   the connection and the sync history were there, the **mapping table** was not,
   and `useSaveMappings` had zero consumers. Found by grepping the data layer for
   exported hooks nothing calls, which is the check worth repeating on any module
   that looks finished. Building it also needed a route that did not exist:
   `setMappings` could write but nothing could READ a saved mapping back, so a
   settings screen would have shown an empty table over saved data. Added
   `listMappings()` + `GET /v1/finance/accounting/:id/mappings`.

   One backend gap surfaced while building: `GET /v1/finance/jobs/:type/:id`
   answered "what did this job cost" but nothing RANKED jobs, which is the whole
   point of the surface. Added `jobProfitability()` + `GET /v1/finance/jobs`
   ([packages/finance/src/jobs.ts](../packages/finance/src/jobs.ts)), worst-margin
   first by default because the losing jobs are the actionable end of the list.
   It carries `revenueBasis` per row — an order knows what it collected, a booking
   only knows its service's list price, and the surface labels every list-price
   row rather than blending the two into one misleading number.

5. ~~**finance-worker**~~ — **done.** A package inside `services/event-worker` (not
   a Deployment), handling recurring generation and rollup recomputation, with a
   400-day clamp so a replayed event cannot loop in the shared process. Five
   `finance.*` events added to the catalog AND provisioned in
   `terraform/envs/prod/main.tf` — `check:events` fails otherwise, and an
   unprovisioned topic means every publish silently fails in production.
6. ~~**Connectors**~~ — **done for CSV, and the OAuth round trip is now complete
   end to end apart from the vendor apps.** A zero-dependency RFC-4180
   reader/writer, seven provider export layouts, and a two-phase (preview →
   commit) importer. **`accounting` is deliberately NOT yet a member of
   `IntegrationCategory`** — it goes in with the first real adapter, not before.

   **The connect flow, finished 2026-08-13.** The QuickBooks Online and Xero
   adapters and their three API routes (`:id/connect` → `callback` →
   `:id/disconnect`) landed with docs/146 Phase 10.7–10.8, but **nothing in the
   repo called any of them** — no button, no landing route — so the round trip
   existed and could not be started. It now runs from
   [apps/workbench/surfaces/finance/accounting.tsx](../apps/workbench/surfaces/finance/accounting.tsx)
   through a popup, landing on
   [app/finance/accounting/callback](../apps/workbench/app/finance/accounting/callback/page.tsx).
   Four things about it are load-bearing:
   - **The row is created before the redirect** and its id rides in the signed
     `state`. Abandoning the consent screen leaves a visible, deletable row that
     says _Not signed in_, rather than nothing at all.
   - **The callback forwards EVERY query parameter**, not just `code`/`state`.
     QuickBooks puts the company file id in `realmId` there and nowhere else; drop
     it and the connect appears to succeed and every later request 401s.
   - **The popup opens synchronously on the click**, before either request, or the
     browser blocks it. There is deliberately no full-page-redirect fallback — this
     pane can hold a half-typed account-code mapping, and navigating away would
     discard it silently — so a blocked popup is reported instead.
   - **Sign-in state is read from `connected`, never from `status`.** `status` is
     `'active'` from the instant the row is written, which is before the provider
     has seen anything.

   Availability is unchanged and still honest: with no `SPARX_QBO_CLIENT_ID` /
   `SPARX_XERO_CLIENT_ID` on the deployment, both read `coming_soon`, the control
   is disabled with the reason shown, and the export stays the answer. **No live
   round trip has been exercised** — that needs the vendor apps registered.

   **And the settings themselves were unreachable, which affected every tenant
   today rather than only future OAuth users.** A connection row is what holds
   the books-closed date and the category → account-code mapping — this screen's
   own header calls the first "THE MOST IMPORTANT FIELD HERE" and the code calls
   the second "the whole reason the export is worth anything to a bookkeeper".
   The only control that created a row lived in the _Sending it automatically_
   list, which deliberately excludes `csv` — **the one provider that is actually
   available.** So nobody could ever create one, and every export went out under
   raw sparx category names for somebody to re-file by hand at the other end.
   Fixed with a "Set up account codes" affordance on the export panel, which is
   where a person is standing when they care: verified by creating the row,
   mapping two categories and saving ("2 categories mapped"). Note the shape of
   this bug — **every individual piece was built and tested, and the path between
   them did not exist.** It is the same failure as the missing OAuth client, one
   screen over, found the same way: by asking what a person would actually click.

   **One security bug was fixed on the way.** `GET /v1/finance/accounting`
   serialised the raw Prisma row, so `access_token_enc` and `refresh_token_enc`
   were sent to every `viewer` who opened the screen. The workbench's own
   `AccountingConnection` interface listed only the safe fields, which is exactly
   why nobody saw it — **a type on the client is a claim about the wire, not a
   filter on it.** `toPublicConnection` in `@sparx/finance` is now the allow-list,
   applied at the three places a connection is returned, and
   `connections.test.ts` pins its exact key set so any new field has to be
   reviewed rather than silently shipped.

7. ~~**Marketing site**~~ — **done.** `finance` added to every place `apps/web`
   enumerates modules: the catalog + its four color maps + the icon, the megamenu
   grouping (a typed `Record`, so it broke the build until it was given a column —
   working exactly as its own comment promised), the pricing ledger, the feature
   table, both switchboards' `ELSEWHERE_MONTHLY`, the platform page, and the
   vertical registry's `StackModule` union. `module-finance` is now registered in
   `apps/web`'s `@plugin` block and has a `MODULE_HEX` entry — without both, every
   `bg-module-finance` would have rendered unstyled grey, silently.

   The module count moved 12 → 13 across the site, and with it the headline savings
   figures ($3,832 → $3,886 separate; $41,000 → $41,700 a year). Finance's
   "replaces" line is **an expense tracker, never QuickBooks** — the ledger
   footnote says so outright. Claiming otherwise on the pricing page would
   contradict §1 in the one place a buyer is deciding whether to trust us.

8. ~~**The `/finance` landing page**~~ — **done.** A bespoke six-beat page
   ([finance-page.tsx](../apps/web/components/marketing/finance-page.tsx) +
   `finance-sections` / `finance-profit` / `finance-money`), registered in
   `ModulePageSlug` + `MODULE_ORDER` so the sitemap, both `llms*.txt` routes and
   the platform page picked it up with no further edits, and the catalog tile
   finally carries its `href`. Five layers present, per DESIGN.md §2.5.

   Three decisions in it are worth keeping:
   - **The false fix concedes.** Beat 3 shows an accountant's category list that
     is CORRECT and sums to the same $8,090 the rest of the page uses, then
     attacks the grain rather than the accuracy. "Your books are right and still
     cannot tell you whether the van wrap made money" is a much harder claim to
     argue with than "accounting software is bad", and it is the only version
     compatible with §1. The concession is what buys the turn its credibility.
   - **The price lives in the TURN**, not only in the pricing band. "Free with
     Commerce or B2B" is the same sentence beat 4 is already making — you bought
     the revenue half, so the subtrahend is not a second product (§2). Anywhere
     else on the page it degrades from a principle into a promotion.
   - **One worked example reconciles across every device**: a sign shop's March,
     sales $48,210 / work $19,640 / wages $14,300 / running $6,180 / kept $8,090.
     The hero's proportion bar, the false-fix ledger, the profit card and the
     twenty-one daily bars all land on those figures — the bars sum to $8,090
     exactly. A page about money whose own columns do not add up is arguing
     against itself.

   The page's three cost hues are imported from the same vocabulary the product
   uses (`kindColor` in the workbench's `format.ts`), so a visitor who signs up
   meets the colors they were just shown. And the accounting section says
   **download** rather than **sync**: only the spreadsheet provider is
   `available` today, and the page names direct QuickBooks Online / Xero sync as
   coming — the alternative is exactly the "we integrate with QuickBooks" lie §6
   opens by naming.

9. **Labour** — lands with [149](149-staff-management.md).

---

## 11. Two production bugs found by clicking Spending

Both were shipped, both were invisible to typecheck, lint and 85 passing tests,
and together they meant the whole money-out half did nothing for anybody.

### The list endpoint answered 422 to every caller

`listExpensesSchema` spells `limit` as `z.int()` and `unpaidOnly` as
`z.boolean()`. That is correct for a **service** contract and wrong for a
**query string**, where every value arrives as text: `z.int()` rejects `"50"`
outright. The `.default(50)` is what hid it — omit the parameter and the schema
passes, send it and the route answers 422 forever. The workbench always sends it,
so `GET /v1/finance/expenses` had never once succeeded and Spending showed its
"could not be reached" state for every tenant since launch.

The two fields are now re-declared on the ROUTE's `ListQuery` with `queryInt` /
`queryBool` from `@sparx/api-core/query`. Doing it there rather than in
`schemas.ts` keeps that file's zod-only, browser-importable promise intact.

**The same mistake, in its other form, was in 42 route files**:
`z.coerce.boolean()` is `Boolean(value)`, and `Boolean('false')` is `true` — so
`?include_archived=false` **included** archived records, platform-wide. Three
route files had already written a comment warning about it and hand-rolled a
local workaround; `queryBool` is that workaround, once, and all 63 call sites now
use it.

### Nothing ever seeded the expense categories

`provisionFinance` seeds the category set and its own doc comment says it is
"called by the module-activation path". **Nothing outside its tests ever called
it.** So no tenant had a single category row, which meant:

- Spending had nothing to file a cost against; and
- the staff labour deriver — which resolves the `wages` bucket BY SLUG and
  correctly refuses to invent one — failed `STAFF_WAGES_CATEGORY_MISSING` on
  every run, so approved hours never became a wage cost. The entire
  [149](149-staff-management.md) chain was inert.

A dry run over the dev database found **49 tenants with finance available and
zero categories, every one of them bundled** via Commerce or B2B.

That bundling is the part worth keeping in mind. Finance is `BUNDLED_FREE`, so
its flag is never written — but `applyModuleWrites` deliberately announces
**derived-state** transitions, and its comment already said why: "enabling B2B
makes `invoicing` available with no invoicing flag of its own, and its seeding
consumer must still run." The announcement was right; the consumer was missing.
`packages/finance-worker` now handles `module.activated` and provisions on it.

Adding a subject to a shipped durable is safe — `consumers.add` upserts, so the
cursor is not reset — and with `DeliverPolicy.All` the widened filter replays
whatever is still inside the stream's retention window, which is a free partial
backfill. Tenants whose activation has aged out are repaired by the ops task
**`backfill-finance-categories`** (dry-runs by default, create-only, safe to
re-run, and composes with `tenant` for a single account).

## 12. Three more, found by clicking the thing the fix was supposed to enable

Running the backfill and then following the wage cost onto the screen turned up
three further defects. All three share the shape of the two above: **nothing
threw, and every number rendered.**

### The backfill could not see its own writes

Immediately after an apply that reported `49 seeded`, the dry run reported
`0 already seeded, 49 to seed`. The apply had worked; the report was blind.

`finance_expense_categories` is `FORCE ROW LEVEL SECURITY`, and the script's
eligibility check was a bare `prisma.financeExpenseCategory.count()`. With no
`app.tenant_id` on the connection RLS filters every row out and the query returns
**0 — it does not error**. So the "already seeded" branch was dead from the first
line it was written, and every run reported a fiction. The count now runs inside
`withTenant`. _Reading a tenant-scoped table outside a tenant context does not
report emptiness; it reports nothing, and the two are not the same number._

### `categoriesSeeded` counted rows it had touched, not rows it had created

`seedCategories` upserts all 20 rows on every run and returned them all, so
`provisionFinance` reported `categoriesSeeded: 20` whether it had provisioned a
brand-new tenant or re-run against a complete one. A redelivered
`module.activated` logged twenty seeded categories having created none.

It now reads the existing slugs inside the same transaction and returns `created`
alongside `categories`; `FinanceProvisionResult` carries `categoriesSeeded` (rows
created) **and** `categoriesTotal` (rows the tenant has), because a bare `0`
cannot be told apart from "this tenant has no categories". Worth noting the
worker's unit test had _asserted_ the zero-on-redelivery behaviour against an
implementation that never did it — a mocked return value is only a claim about
the real one, and this one was false. The integration test
`reports rows it CREATED, not rows it touched` is what actually pins it now.

### The wage cost was filed into the future

With categories seeded, "Re-file this period" succeeded and reported _"Your
spending and profit figures now include this period's wages."_ Spending, on the
same screen, showed **$0.00 — nothing recorded yet**.

The deriver dated the accrual `incurredAt: periodEnd`. Approving hours on 13
August filed a cost dated **31 August**, and every current-period range runs
`1st → today`, so the cost the platform had just created was invisible in the
view it had just pointed at. It is now dated the **last day actually worked** in
the period, per site. That is always inside the period, so it buckets into the
same month and no closed-period figure moves — it simply is not in the future.

### And the day it landed on displayed as the day before

Once visible, the row read **"Aug 10, 2026"** for an `incurredAt` of
`2026-08-11`. `incurredAt` is a `Timestamptz` column that only ever carries a
calendar DAY — `period.ts` filters it as one, and the deriver writes it straight
from a `@db.Date` `workedOn`, so it is always UTC midnight. Handing UTC midnight
to `toLocaleDateString` renders it in the reader's zone, which is the previous
day for everyone west of Greenwich.

`formatDay` (UTC) now sits beside `formatDate` (instants), and the six
day-valued call sites use it: `incurredAt`, `dueAt`, `nextRunOn`, `endsOn` and
the accounting range bounds. `job.occurredAt` and the Stripe timestamps are real
instants and keep `formatDate`.

The same confusion was in the **lateness arithmetic**, where it was worse than a
label: `(now - dueAt) / 86_400_000` compares a UTC-midnight day against a local
instant, so from early evening a US reader saw a bill due TODAY badged "1 day
late" — and in `bills-to-pay` the same expression also chose the aging bucket, so
the bill was filed under "1–30 days late" too. Both call sites now use one
exported `daysPastDue`, which compares whole days.

---

## 13. Nothing was scheduled (0.7)

Finance was **the only module in the platform with no cron file.** Every other one
has an `internal/<module>-cron.ts` and a matching `k8s/cronjobs/*.yaml`; finance
had neither, and `packages/finance-worker` had been sitting there since launch
handling two events **nobody published**. Two whole capabilities looked finished
and did nothing:

- **Repeating costs never generated.** A tenant sets up "Rent — $2,000, every
  month" and no expense is created, in any month, for anyone. The surface saves
  a template that nothing reads.
- **The profit cache was never filled.** `profitForRange` READS
  `rollup_finance_daily_profit`; only `recomputeDay` writes it, and `useProfit`
  does not pass `refresh`. So Profit showed zeroes until somebody pressed the
  manual recompute, and went stale again immediately. `spend-data.ts` even says
  "waiting for tonight's worker is not an answer" — about a worker that had no
  scheduler.

Both endpoints **publish** rather than doing the work: the handlers already
exist and are tested, and the broker gives them retries and a dead-letter queue
without holding a sweep over every tenant open on the API pod.

### Why the tenant list is derived, not read off the flag

The established scheduler pattern enumerates with
`settings: { path: ['modules', '<slug>', 'enabled'], equals: true }`. **That would
have found zero finance tenants.** Finance is `BUNDLED_FREE` with commerce/b2b, so
the flag is never written for anyone who gets it bundled — measured on the dev
database, the derived set is **49 tenants and the flag query returns 0**. A cron
built on the flag would have run nightly, reported success, and served nobody.

`lib/module-tenants.ts` derives availability the way the module gate does, and the
category backfill now shares it.

### Live, as well as nightly

The rollup cron is the backstop, not the mechanism. Recording, correcting or
deleting an expense publishes `finance.expense.recorded`, so the figure moves
while you watch. Marking one **paid** deliberately does not — profit buckets on
`incurredAt`, and when the money left changes nothing about which period the cost
belongs to (§1, decision #6).

### Schedules

| Job                     | Time (UTC) | Why then                                                                                                   |
| ----------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| `finance-recurring-due` | 05:30      | A cost generated today must exist before the rollup meant to include it.                                   |
| `finance-profit-rollup` | 06:45      | After commerce revenue (06:00) and invoicing collected (06:30) — profit subtracts from what those produce. |

The rollup recomputes a **two-day** trailing window by default, not one: today's
figures are still moving, and a job that only ever recomputed "today" would leave
yesterday frozen at whatever it was when the job last ran. `?days=` widens it.

### Run end to end (2026-08-16)

Both endpoints had been written, reviewed and never called. They were fired
against the local database through the real router, with the dev transport
pointed at a sink that fed each published event straight into `finance-worker`'s
own `handle()` — the chain the cluster runs, with nothing stubbed but the
delivery:

| Endpoint                               | Tenants         | Consumer outcome  |
| -------------------------------------- | --------------- | ----------------- |
| `POST /internal/finance/recurring-due` | 49 ok, 0 failed | 49 × `generated`  |
| `POST /internal/finance/profit-rollup` | 49 ok, 0 failed | 49 × `recomputed` |

**49 is the number this scheduler exists for.** The flag query the other
schedulers use returns **0** for finance, because it is BUNDLED_FREE with
commerce/b2b and its settings flag is therefore never written — see §13's note on
deriving the tenant list. Both payload contracts survived the round trip: the
cron publishes `{ through }` and `{ from, to }` as ISO strings and the worker's
`z.coerce.date()` accepts them, which is a publisher-to-consumer seam no test on
either side covers alone.

Two zeros in that run are honest rather than broken, and both were checked:
`generated=0` because no tenant has a repeating cost whose next run has come due,
and `days=0` because `recomputeDay` writes a rollup row only for a day with
activity — and the two days the sweep covered are quiet ones.
