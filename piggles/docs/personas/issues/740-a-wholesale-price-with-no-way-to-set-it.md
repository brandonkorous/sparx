# 740 — Two wholesale prices that could only be deleted, under two screens one letter apart

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 265
**Surface:** mypiggles + sparx workbench — Wholesale price (the product panel), Wholesale groups, Wholesale customers; api-rest
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, end to end: made a group, a customer, and all three kinds of price
**Blocked on:** —

## 1. The launcher offered two screens one letter apart

Typing "wholesale price" into the box, as the shop owner:

```
Sell
  Wholesale price      → commerce.product.trade-pricing     what ONE product costs
  Wholesale prices     → b2b.pricing-tiers.list             the named sets of shops
  Special prices       → commerce.pricing.list
```

Two unrelated screens, one letter apart, stacked under one heading. The
launcher groups by APP and Piggles' **Sell** app fronts commerce AND wholesale,
so nothing on the row said which was which.

A third surface, `b2b.pricing-tier.detail`, carried the first one's string
**exactly**.

The list screen was not even a price. It is a named set of businesses you
charge the same way, and the console had three words for that one idea:

| where                      | what it called a group |
| -------------------------- | ---------------------- |
| the product panel          | "customer group"       |
| the list screen's own name | "Wholesale prices"     |
| that screen's empty state  | "a named trade level"  |

Renamed: `b2b.pricing-tiers.list` → **Wholesale groups**,
`b2b.pricing-tier.detail` → **Wholesale group**, and every sentence on both
screens with them. `check:screen-name-collisions` is the new guard — it
resolves each console's titles the way the launcher does (catalog, overridden by
vocabulary, minus `hiddenSurfaces`), groups them by the heading they render
under, and fails on a duplicate or a plural inside one heading. It found a
second one nobody had reported: **"Saved pieces"** and **"Saved piece"** sat
together under My Site, both leading to a list of pieces. The editor is now
**Edit a piece**.

MEASURED: piggles 213 listed surfaces (302 registered), sparx 218 (300).
**sparx passes on its own** — it groups by module, so its four Reports screens
sit under four different headings and a person can already tell them apart.

## 2. Two of the four prices could be deleted and not created

The pane renders four kinds of rule. It could CREATE one.

```
POST /v1/b2b/pricing-tiers/:id/overrides      called by the pane ✓
POST /v1/b2b/accounts/:id/overrides           REST route exists, NO console caller
POST /v1/commerce/contract-prices             REST route exists, NO console caller
DELETE on both of the above                   called by the pane ✗ ← only half
```

**MEASURED 2026-09-19:** `b2b_account_product_overrides` **0 rows**,
`commerce_contract_prices` **0 rows** — across all 43 tenants on the machine.
Every one of those delete buttons had gone its whole life with nothing to press
on. [[feedback_screen_over_a_function_nobody_calls]]

`product-pricing.ts` said, in its own header: _"It is READ-ONLY on purpose:
every write already has a home on the resource that owns it."_ True of the API.
False of the console, which is the only place a shop owner stands.

## 3. And the empty state sent her to a screen that is not called that

> "Create one under your **trade customers**, then come back and set what this
> product costs them."

Three things wrong in one sentence. The screen is called Wholesale customers.
Groups are not made there. And it was not a link.

## What was done

**One form, four questions, all three kinds.** "Who gets it" is answered first
and the rest follow: everyone in a wholesale group, or one business. Three cards
asking the same four questions three times would have been the alternative.

**The end date is the whole of the third kind.** A standing price for one
business and a signed agreement differ in the data by their dates and in a shop
by whether anything was promised. So the form asks the one question a shop owner
can answer, and says what answering it does: _"Leave this empty and they simply
get this price from now on"_ / _"Putting a date on it records it as an
agreement, starting today."_

**The dead end is two working buttons.** With no groups and no businesses the
card explains what each is and opens either one.

## 4. Found on the way: the screen listed them in the opposite order to the charge

Split out as [742](742-the-screen-said-72-and-the-till-said-52.md), because it
is a wrong PRICE on a screen rather than a missing one.

## 5. Found on the way: a date typed and thrown away

Split out as [741](741-a-date-typed-and-thrown-away.md). 82 date boxes across
the two consoles, none of them able to tell "empty" from "half typed".

## 6. Small ones, fixed here

**"Account" was Money's word, and wholesale kept using it.** The screens were
renamed off it and their bodies were not: "trade accounts" ×5 on the customers
list, "Accounts on this tier", "0 accounts" in a toolbar badge, "1 account" on
every group row. All now say businesses or customers.
[[feedback_a_fix_leaves_its_neighbour_behind]]

**The rail's + and the pane's own button disagreed.** `PIGGLES_CREATE_LABELS`
exists to stop exactly that (issue 729) and only ever reached the rail: the rail
said "Add a wholesale customer" and the pane's button said "Add a trade
account". Fixed here. MEASURED across the class: 58 surfaces carry a create
label, and 11 never contain it in their own file. Filed as
[743](743-the-rail-and-the-pane-name-one-action-twice.md).

**A builders' merchant in a clothes shop.** The company name placeholder read
"Acme Building Supplies" and the group examples were "Trade, Distributor,
Fleet". Fleet is a diesel word. [[feedback_industry_agnostic_no_diesel]]

**A row crushed at 360px.** "MARLOW-KNIT-XL-MOSS · normally $96.00" broke one
syllable per line because the price block squeezed the left column instead of
folding under it. `basis-48` makes it fold.

## Checked and NOT a defect

**A group's blanket discount has its own card and no remove button.** Right: a
tier scoped to `all` was never set up on this product, so there is nothing here
to remove. The card says so.

**The version picker is hidden on a one-version product.** A control with one
option is a question nobody asked.

## Files

- `piggles/apps/workbench/lib/console/vocabulary.ts`
- `piggles/apps/workbench/lib/surfaces/catalog/builder.ts`
- `piggles/apps/workbench/surfaces/b2b/{pricing-tiers-list,pricing-tier-detail,accounts-list,account-detail}.tsx`
- `piggles/apps/workbench/surfaces/b2b/pricing-tiers-data.ts`
- `piggles|sparx/apps/workbench/surfaces/commerce/product-trade-pricing.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/products-data.ts`
- `piggles/scripts/check-screen-name-collisions.mjs` — new
- `package.json` — `check:screen-name-collisions`
- `wizeworks/services/api-rest/src/routes/v1/b2b/product-pricing.ts` — the comment that said the write had a home

## Proof

On screen in Juniper Row's console, then in the database:

1. Wholesale price on Marlow Knit, with nothing set up: **Open Wholesale
   groups** and **Open Wholesale customers**, both of which open.
2. Made **Stockists**, 40% off everything, minimum order $250.
3. Made **Loom and Larder**, on Stockists.
4. Back on the product, three prices in three shapes:
   - **Signed agreement** · $52.00 · 46% below list · Agreed until Mar 31, 2027
   - **Just this business** · $72.00 · 25% below list
   - **Everyone in this group** · $48.00 · 50% below list
5. `commerce_contract_prices` now holds one row —
   `valid_from 2026-09-19 00:00:00+00`, `valid_to 2027-03-31 23:59:59+00`, the
   inclusive end `dayEndUtc` intends. It is the first one on the machine.

Both panes checked in light and dark and at 360px.

Piggles 1,105 tests / 118 files, sparx 975 / 105, api-rest 243 / 30. Four
typechecks clean; ESLint clean on every changed file; **all 54 structural checks
pass**. `check:screen-name-collisions` was proved red four ways: the same name
twice, a plural inside one heading, the headings map renamed out from under it,
and the catalog moved.
