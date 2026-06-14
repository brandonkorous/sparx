# Dashboard list/index page audit — Collection/List standard compliance

**Date:** 2026-06-13

## The actual standard (docs/34)

This audit is measured against the **documented** Collection/List archetype, not just "has a table."

- **§4 Archetype 2 — Collection / List** (`/{module}/{things}`, Full width):
  body = **`ListToolbar` → `DataTable` / auto-fill card grid (view toggle) → pager**.
- **§7.1 / §7.2 — the view toggle is the point.** A segmented `[▦ ▤]` control flips the list between
  **Table** and **Cards**. It reads `?view=` (transient per-view override) falling back to the user's
  **`defaultListView`** preference (global, persisted on `User.preferences`, mirrors
  `defaultDetailView`). "The same _kind_ of list behaves consistently from one surface to the next."
- **§7 — exceptions are narrow.** Mobile cards are just the responsive form of the table (automatic,
  not a choice). The _only_ sanctioned single-rendering exception is a **browse/library view where the
  content itself is visual** (e.g. CMS Media's thumbnail grid), which omits the toggle.
- **Not Archetype 2 (correctly excluded):** reports / analytics / dashboards, module-overview
  landings, settings/config forms, visual editors/canvases, and not-yet-built placeholders.

So the compliance question is **not** "does it have a table" — it's **"does the user get the
Table/Cards toggle, defaulting to their `defaultListView`."** A table-only list and a cards-only list
are _both_ non-compliant: each locks the user into one rendering.

The reference implementation is `commerce/products` — `ListToolbar enableViewToggle` + a
`*-selection-table` component that renders **both** `view='table'` and `view='card'`.

---

## 🟢 Tier 0 — Fully compliant (ListToolbar + view toggle + dual-view render) — **6 pages**

These are the only pages that actually implement the documented toggle today.

`commerce/products` · `commerce/collections` · `cms/content` · `crm/customers` ·
`builder/components` · `seo`

> Verified: these are the only 6 that both pass `enableViewToggle` to `ListToolbar` **and** have a
> render component that switches on a `view` prop (`*-selection-table.tsx` / page-level).

---

## 🟠 Tier 1 — Has `ListToolbar`, but **table-locked** (no view toggle, ignores `defaultListView`) — **19 pages**

The biggest and cheapest-to-fix gap. These already have the filter bar (search/filter/sort), so the
only missing pieces are `enableViewToggle` on the toolbar + a card branch in the render component.
A user who sets "Default list view → Cards" sees no effect here.

`b2b/accounts` · `b2b/invoices` · `b2b/quotes` · `commerce/carts` · `commerce/checkout-sessions` ·
`commerce/discounts` · `commerce/gift-cards` · `commerce/inventory` · `commerce/qa` ·
`commerce/returns` · `commerce/reviews` · `commerce/subscriptions` · `crm/b2b` · `crm/orders` ·
`crm/quotes` · `dropship/products` · `dropship/suppliers` · `inventory/sources` · `invoicing`

**Why:** built before the toggle convention solidified (or copied from a pre-toggle template). The
toolbar landed; the dual-view render + `defaultListView` wiring never followed.

---

## 🔴 Tier 2 — Has a table, but **no `ListToolbar` at all** — **18 pages**

Record-shaped lists with neither the filter bar nor the toggle. Need the full Archetype-2 treatment
(toolbar + dual-view render). Split by tractability:

**Straightforward record lists** (clean migrations):

| Page                      | Renders                 | Why it deviates                                                                          |
| ------------------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| `b2b/appointments`        | raw `<Table>`           | Backend already filters by `status`/`account_id` via query params — UI just never built. |
| `b2b/approval-queue`      | raw `<Table>`           | Same — `account_id` query param, deep-link-only, no toolbar.                             |
| `b2b/service-types`       | raw `<Table>`           | Small fixed reference list; no filtering added.                                          |
| `cms/types`               | raw `<Table>`           | Fixed schema catalog; no filtering added.                                                |
| `commerce/account-credit` | raw `<Table>` (2 cards) | Treated as a summary, not a browseable list.                                             |
| `commerce/bundles`        | raw `<Table>`           | Small dataset; no backend search/pagination.                                             |
| `commerce/configurator`   | raw `<Table>`           | Small template set.                                                                      |
| `commerce/tax`            | raw `<Table>`           | Tax-zone registry; no pagination/search.                                                 |
| `commerce/warehouses`     | raw `<Table>`           | Small config dataset.                                                                    |
| `email/suppressions`      | raw `<Table>`           | Low-volume list; static display.                                                         |
| `inventory/locations`     | raw `<Table>`           | Small static location set.                                                               |
| `invoicing/templates`     | raw `<Table>`           | Small template collection.                                                               |

**Need a design call first** (custom managers / multi-entity pages — don't map 1:1 to one toolbar):

| Page                     | Renders                             | Why it deviates                                             |
| ------------------------ | ----------------------------------- | ----------------------------------------------------------- |
| `commerce/markup-rules`  | custom `MarkupRulesManager`         | Bespoke config manager predating the pattern.               |
| `commerce/surcharges`    | custom `SurchargesManager`          | Bespoke config manager predating the pattern.               |
| `commerce/price-reviews` | custom `PriceReviewsManager`        | Status-filtered work queue; bespoke component.              |
| `commerce/pricing`       | multiple `<Table>`s (lists + tiers) | Two entities on one page — one toolbar doesn't map cleanly. |
| `commerce/shipping`      | two `<Table>`s (zones + profiles)   | Two entities on one page — needs sectioning.                |
| `commerce/providers`     | grouped `<Table>`s by kind          | Registry grouped by category; fixed structure.              |

---

## 🟡 Tier 3 — Renders **cards, but no `ListToolbar`** (no toggle, no search/filter/sort) — **11 pages**

Under the corrected standard, cards-as-default is _fine_ — but only with a toolbar that offers the
toggle (and a Table branch). These have the cards and miss the toolbar entirely.

| Page                 | Renders                          | Why it deviates                                                      |
| -------------------- | -------------------------------- | -------------------------------------------------------------------- |
| `automations`        | card grid                        | Has bespoke status/email tab-chips; never migrated to `ListToolbar`. |
| `builder/blueprints` | card grid                        | Installed-blueprints catalog; limited scope.                         |
| `cms/authors`        | cards grid                       | Small static list.                                                   |
| `cms/redirects`      | cards (inline CRUD)              | Inline-edit pattern, not a DataTable.                                |
| `cms/taxonomy`       | cards grid                       | Small metadata catalog; rows link to term editor.                    |
| `crm/pipelines`      | cards                            | Small set; has a show/hide-archived toggle only.                     |
| `crm/segments`       | cards                            | Small set; has a show/hide-archived toggle only.                     |
| `crm/tasks`          | grouped rows (overdue/open/done) | Grouped by status; no search/sort/filter.                            |
| `b2b/pricing-tiers`  | cards grid                       | Reference data; card overview.                                       |
| `email/broadcasts`   | cards grid                       | Status badges + bulk actions instead of a toolbar.                   |
| `email/domains`      | card grid (`DomainCard`)         | Small dataset; static.                                               |

---

## ⚪ Correctly NOT Archetype 2 — no toggle/table expected (excluded)

| Page(s)                                                                                        | Kind                                 | Note                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `commerce/reports`, `crm/reports`, `dropship/analytics`, `commerce/wishlists`, `commerce/lots` | **Reports / analytics / dashboards** | Per decision 2026-06-13: these do **not** need a table or `ListToolbar`. Read-only aggregations with their own range controls.                                                 |
| `commerce/products/pricing`                                                                    | Bulk repricing **tool**              | Not a list.                                                                                                                                                                    |
| `ai`, `builder`, `cms`, `commerce`, `crm`, `email`                                             | Module overview dashboards           | Stat grid + SectionCard launchpad (Archetype 1).                                                                                                                               |
| `b2b`, `dropship`, `inventory`                                                                 | Redirects                            | Redirect to first sub-list.                                                                                                                                                    |
| `settings/*` (10), `commerce/settings`, `email/settings`                                       | Settings/config forms (Archetype 5)  | Single-entity config.                                                                                                                                                          |
| `builder/brand`, `builder/component`, `builder/email`, `builder/page`, `builder/site`          | Visual editors/canvases              | Authoring surfaces.                                                                                                                                                            |
| `commerce/categories`, `commerce/fitment`                                                      | Tree / taxonomy editors              | Hierarchical, not flat lists.                                                                                                                                                  |
| `cms/legal`                                                                                    | Config forms                         | Inline editor.                                                                                                                                                                 |
| `cms/media`                                                                                    | **Library exception**                | §7 sanctioned thumbnail grid (toggle omitted). _But_ it has no search/filter at all and is hard-capped at 100 (TODO) — worth a lightweight toolbar even if it keeps grid-only. |
| `crm/duplicates`                                                                               | Merge tool                           | Specialized cluster-merge UI, not a browse.                                                                                                                                    |
| `marketplace`                                                                                  | Discovery hub                        | Category tiles + featured grid.                                                                                                                                                |
| `chat`                                                                                         | Stub landing                         | Conversation chosen elsewhere.                                                                                                                                                 |
| `cms/navigation`                                                                               | **Deprecated**                       | Navigation moved to Builder.                                                                                                                                                   |
| `cms/webhooks`                                                                                 | **Placeholder**                      | Incomplete; EmptyState pending Phase 5+ CRUD.                                                                                                                                  |

---

## Bottom line & root cause

- **Only 6 of ~54 list-shaped pages implement the documented Table/Cards toggle.** The standard
  (docs/34 §7.1/§7.2) treats the toggle + `defaultListView` as the default for _every_ record list;
  in practice it shipped on a handful of pilots and never propagated.
- **The dominant gap is Tier 1 (19 pages): they have the toolbar but are table-locked.** That makes
  the global "Default list view → Cards" preference a near-no-op platform-wide — it only affects 6
  surfaces — which is itself a consistency bug (§7.2: "the same kind of list behaves consistently").
- **The fix is mechanical and reusable.** Tiers 0's `*-selection-table.tsx` components are the
  template: a render component that takes `view: 'table' | 'card'`, plus `enableViewToggle` on the
  toolbar. Tier 1 just needs that component + flag. Tier 2/3 additionally need the toolbar wired.

**Suggested order:** Tier 1 (cheapest, biggest consistency win — already have toolbars) → Tier 2
straightforward list → Tier 3 cards-lists → Tier 2 "design call" managers/multi-entity pages →
revisit `cms/media` (search-only toolbar).

---

## ✅ Resolution (2026-06-13)

Built the shared **`SelectionList`** dual-view primitive in `@sparx/ui` (table + card + selection +
`BulkActionBar`, plus a `selectable={false}` read-only mode and a `card.render` escape hatch) and
migrated **52 list pages** onto it (up from 6 with the toggle). Also added an optional **refresh
button** to the shared `ListToolbar` (`onRefresh` → `router.refresh()`, default-on for all lists).

- **Migrated:** all of Tier 0 (refactored), Tier 1 (19), Tier 2 straightforward (12), Tier 2
  multi-entity `pricing`/`shipping`/`providers` (per-section `SelectionList`, one shared toggle), and
  Tier 3 (11 — card-grids gained a table view; bespoke tab/toggle filters moved into `ListToolbar`).
- **Architecture note:** `SelectionList` takes render-function props, so it must render inside a
  `'use client'` wrapper — every list got a thin `_components/*-list.tsx` wrapper; the server page
  passes only serializable data + `view`.
- **Left compliant-as-is:** `builder/components` (already had the toggle; its catalog carries React
  icon component refs that can't cross the client boundary, so inline server rendering stays).
- **Newly excluded by design (documented):** `markup-rules`, `surcharges`, `price-reviews` —
  inline rule/approval **editors**, not browse collections; `cms/media` — sanctioned library grid,
  server-side search is API-deferred so a toolbar would be a dead control.
- Verified: `@sparx/ui` + dashboard typecheck clean, lint 0 errors, formatted. **Uncommitted.**

---

## 🔜 Follow-ups (decided, NOT yet built)

### Pagination — none of the lists page today

**Decision (2026-06-13):** offset **page-number** pagination via `?page=` / `?per_page=` (default
**50**, with a 25/50/100 size selector). Build a shared **`<Pager>`** primitive in `@sparx/ui`
(presentational: currentPage/pageCount/total + `onPageChange`/`onPageSizeChange`; lift styling from
the existing `DataTablePager`), rendered below `<SelectionList>`. The `ListToolbar` wrapper already
resets `?page=` on any filter/search/sort change.

**Built:** shared `<Pager>` (`packages/ui/src/components/data/pager.tsx`), dashboard `ListPager`
URL-sync wrapper (`_components/list-pager.tsx`), `parsePageParams` helper (`lib/pagination.ts`).

- **✅ Phase 1 DONE (2026-06-14)** — routes already exposing `skip` + `total` were wired (browse:
  `skip`/`take`; search branch: `page`/`per_page`; `<ListPager total={total}/>` below the list):
  `commerce/products`, `crm/orders`, `crm/customers`, `b2b/accounts`, `b2b/appointments`,
  `b2b/approval-queue`, `b2b/invoices`, `b2b/quotes`, `crm/b2b`, `crm/quotes`, `dropship/suppliers`,
  `inventory/sources`. Typecheck + lint clean.
- **✅ Phase 2 DONE (2026-06-14)** — added `skip` + `count(*)` (same WHERE) returning
  `paged(items, { total })` to each route/service, then wired the page. ~33 more endpoints across
  commerce (`collections, discounts, reviews, subscriptions, carts, checkout-sessions, qa, returns,
bundles, configurator, warehouses, inventory, account-credit, tax, shipping, pricing`),
  `cms/{content, types, authors, redirects, taxonomy}`, `email/{broadcasts, domains, suppressions}`,
  `b2b/{pricing-tiers, service-types}`, `inventory/locations`, `invoicing` + `invoicing/templates`,
  `crm/{pipelines, segments, tasks}`, `builder/blueprints`. Service `list()` methods that changed
  array→`{items,total}` had every caller fixed (routes, GraphQL resolvers, MCP read-tools); full-list
  "picker" callers pass `?take=250` to keep their all-rows behavior. All packages typecheck + lint
  clean.
- **⏭️ Skipped by design (grouped, no flat list):** `commerce/providers` (registry grouped by kind —
  offset paging would split a kind's installs across pages) and `dropship/products` (grouped by
  supplier; no `/v1/dropship/products` flat endpoint exists — Ph3 TODO). Forcing paging would break
  their grouped rendering.
- **Note — aggregate badges:** two pages whose header badge was a whole-dataset aggregate a page
  slice can't reproduce now report counts instead: `commerce/warehouses` (was active/inactive split),
  `commerce/account-credit` (was summed outstanding $). Dedicated aggregate endpoints could restore
  those figures later if wanted.
- **Rejected alternatives:** cursor/"Load more" (loses shareable page links, the X-of-N count, and
  clean cross-page selection) — keep keyset as a _scale escape hatch_ if a specific table gets huge.

### ⚠️ Deferred: "Select all N matching" (select-all-across-pages)

With server paging, bulk **"select all" selects only the CURRENT page** — `SelectionList` already
scopes selection to the visible/loaded ids. A true "select all 1,240 matching the filters"
affordance (a banner like _"All 50 on this page selected — Select all 1,240?"_ that switches bulk
actions to operate by filter-query instead of by id list) is **out of v1, to be added when a workflow
needs it**. This requires bulk-action server endpoints that accept a filter spec (not just ids).
**Do not lose track of this.**

### `crm/tasks` — Board (kanban) view instead of the generic card view

**Proposal (2026-06-14):** for `crm/tasks` only, make the view toggle **Table / Board** — a bespoke
kanban _replaces_ the weak generic card view (wide task rows flow awkwardly in the auto-fill grid).
Columns keyed on **due-date buckets** (Overdue · Today · This week · Later · No due date); dragging a
card **reschedules** it (sets `dueAt`). Priority renders as a card accent; the open/done complete
toggle stays per-card (status is binary, so it's not a column axis). NOT part of the shared
`SelectionList` — a per-page implementation reusing the existing deal/pipeline kanban dnd-kit patterns
(drag the whole card, guard the pointer sensor). Needs a `PATCH /v1/crm/tasks/:id` that accepts a new
due date. Status: idea captured, not built.
