# 175 — 372 garments arrived and the count says it was worth $0.00

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 3
**Surface:** mypiggles › Stock › Stock counts (list) · Stock reports
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** re-ran on screen — "No cost yet", then costed 3 lines and watched the figures become real
**Blocked on:** —

## What happened

Devi counted her whole shop into the system — 62 versions, six of each, 372
garments — finished the count and applied it. The confirm was clear and the work
landed correctly. Then the Stock counts list showed her what she had just done:

```
Count                Counted   Difference   Started         State
Main Warehouse       62/62     $0.00        6 minutes ago   Applied
CNT-000001
```

**Difference: $0.00.** Every one of the 62 rows inside the count says "6 units
more than expected" and carries a `+6` correction. The list above them says the
whole thing was worth nothing.

It is not wrong arithmetic. It is arithmetic over an absence: **none of her 62
versions has a cost recorded** — the "What it costs you" field on each version is
an optional "Add your cost" she has never filled in — so 372 × nothing = $0.00.

```
 variants | with_cost
       62 |         0
```

## What should have happened

A column that has nothing to measure says so. **"Not costed"**, or an em-space,
or the count of items missing a cost — anything that is not a number.

$0.00 is a specific claim: it says somebody worked out the value of this change
and it came to zero. Nobody did.

## How to reproduce

Every time, on any tenant that has not entered costs.

1. Add products, leaving **What it costs you** empty (it is optional, and the
   form never asks for it).
2. Stock → Set up your stock → Open counts → start a count, add items, put in
   quantities, finish, apply.
3. Stock counts list: the **Difference** column reads `$0.00`.

## Why it matters

A stock count's money column is what an owner scans to know whether a count
mattered. "$0.00" is the exact reading of **a count that found nothing wrong** —
which is the happy case, the one you glance at and move on from. Here it is
printed over the largest stock event in the shop's history.

The two readings are opposite and the screen cannot tell them apart:

- _"We counted and everything matched."_ ← nothing to do
- _"We moved 372 garments and nobody has told us what they cost."_ ← two jobs to
  do, one of which (entering costs) she does not yet know is missing

And it compounds. Every downstream number built on cost — margin, what the stock
on her shelves is worth, whether a discount is profitable — will be quietly wrong
in the same direction, and this column is the first place that was visible and
did not say anything.

This is the standing rule in
[[feedback_never_present_absence_as_measurement]]: a value nobody measured must
never render as one. It is the third instance in this act alone —
[[173]]'s "Every item kept here is ready to count" over an empty list, [[174]]'s
`"installed": 0` beside a created row, and this.

## Where it lives

[counts-list.tsx](../../../apps/workbench/surfaces/inventory/counts-list.tsx)
rendered the column, and its own comment already knew the shape of this: _"a
session still being counted shows a dash rather than a misleading £0.00 that
reads as everything matched."_ It guarded the still-counting case and not this
one. The same awareness is in `count-detail`'s `BIG_VARIANCE_UNITS`, which
exists to catch "a big swing in items whose cost was never entered (so their
value reads as zero)". So the platform knew; only the list column did not.

The reason it could not tell was real rather than an oversight: a count row
carried `varianceValueCents` and no unit figure, so from the list there was
genuinely no way to distinguish nothing-moved from nothing-costed.

## The fix

**Made, in the shared layer rather than the call site.**
`InventoryCountRow` in
[inventory-count-shared.ts](../../../../wizeworks/packages/inventory/src/services/inventory-count-shared.ts)
gained **`varianceUnits`** — Σ |counted − expected| — computed in `serializeRow`
from lines the query was already loading (`LIST_INCLUDE` picks up
`expectedQuantity` alongside `countedQuantity`). Both brands get it.

With units in hand the column can tell the two apart, in
`counts-list-summary.ts`:

- units moved, value zero → **"No cost yet"**
- nothing moved → the real `$0.00`, which now means what it says
- still counting, or discarded → **"—"**

That last one came out of re-proving this: discarding the two test counts put
three `$0.00` rows on her screen for counts that were **closed without applying
anything**. Same defect, a state I had not thought about — a discarded count has
no difference to report rather than a difference of zero.

Applied piggles RULE #0.5: `counts-list.tsx` 380 → 240, plus `counts-list-table`
(101), `counts-list-summary` (67) and `counts-list-empty` (57).

## Confirmed by

**Her own row, on the same screen that produced the finding.** CNT-000001 now
reads:

```
Main Warehouse       62/62    No cost yet    Applied
CNT-000001
```

and the three discarded counts read **—** rather than `$0.00`. Every figure in
that column is now either a real amount or an admission.

**At 360px**, where the Difference column is gone entirely and the sentence under
the name is the only place these numbers appear, the row reads in full:

> 62 items · 372 units corrected, no cost recorded

That took two further repairs found by looking, not by thinking: the fold-back
line was `truncate`, so at 360px it cut off the only copy of the information the
hidden columns were folding back — it now wraps to two lines. And the count TYPE
was riding on that line eating half of it, despite never having had a column to
fold back from; it is gone from the narrow layout and still on the count itself.

Seen in dark, full width and 360px. **Light not checked** — see [[173]].

## The same absence on Stock reports

Reading `reports.tsx` while fixing [[173]]'s copy in it turned up the same
defect at larger scale, and it was closed in the same pass.

Every money figure on Stock reports is built on recorded costs, so on Devi's
shop the headline stat reads:

```
What your stock is worth
$0.00
372 units on hand · worth $8,940.00 at your selling prices
```

The stat and its own description contradict each other in three lines. The
retail figure is real, because she DID set selling prices; the cost figure is an
absence. "Money sitting still" had the same shape — `$0.00` printed over a line
count saying several lines had not sold in three months.

**Fixed** by `stockIsUncosted(totalUnits, totalCostCents)` in `reports-shared`,
worked out from figures the pane already had: units on hand with a total cost of
zero means nothing has a cost, not that the stock is worthless. Both stats now
say **"No cost yet"**, and the worth stat's description says outright that what
they cost has not been recorded.

Worth noting the platform already knew: `AsOfCard` on the same pane has carried
an `uncostedUnits` warning all along, and its own comment says "a valuation that
silently treats it as worthless is the kind of number an audit finds for you".
The headline stat above it did exactly that.

**Not seen on screen.** Stock reports was never opened as Devi. The change
typechecks and the reasoning is the same one already proved on the counts list,
but under RULE #4 it is fixed-and-unverified until somebody opens the pane. That
is the first thing to do there.

This is a narrower fix than the whole problem: **partial** costing still
under-reports silently, because a shop where nine items in ten have a cost has a
non-zero total and reads as a complete valuation.

## The wider half — closed 2026-08-23

This used to end "the gap is at least honest; making it FILLABLE is the
decision". Brandon's answer was to build it, and the shape follows from where
cost actually comes from.

**Cost arrives with the DELIVERY, not with the product.** Receiving already
stamps a real landed cost per movement, so the product form is left alone: it is
the moment of LEAST knowledge — often before the first delivery, sometimes before
the supplier is chosen — and a required cost field there is a wall across the
five-minute setup for a number nobody can answer yet.

What that leaves is the **opening balance**: the stock already on the shelf on
day one, which no delivery will ever explain. That is the only genuine gap, and
it is now a surface of its own — `inventory.costing.uncosted`, "What your stock
cost you", at `/inventory/costing/uncosted`. It lists every owned variant holding
stock with no cost anywhere, biggest holdings first, so somebody who fills in
five rows and stops has still fixed most of the number.

**Three states, not two.** The previously invisible one was "partly costed" — a
figure that is real but short. `uncostedUnits` is now carried on the valuation
summary (both copies of that query: `@wizeworks/inventory`'s `analytics.ts` and
api-rest's own in `reports.ts`), and `costCoverage()` resolves it to
`none | partial`. Every screen can now tell "nobody has costed anything" from
"this is real, and short by 354 units' worth".

Two decisions inside the write worth naming:

- `setVariantCosts` is guarded to `costCents: null`, so a save racing a real
  delivery can never overwrite a landed cost with somebody's recollection. The
  variants it skipped are counted and reported rather than folded into the total.
- A cost of **zero is refused**. A genuinely free item exists, but it is rare
  enough that letting one through would make every screen downstream unable to
  tell "this cost nothing" from "nobody answered" — which is the whole defect
  this issue is about, reintroduced one layer down.

### Three defects found while confirming it, all fixed

1. **The pane would not load at all.** The raw SQL selected `v.name`; the column
   is `v.title`. A raw query is invisible to `tsc`, so it typechecked clean and
   500'd on the screen. The pane's error state was at least honest about it
   ("Could not work out what is missing a cost · This is a problem reaching the
   server") rather than rendering an empty list as "nothing missing a cost".
2. **Every variant row was identifiable only by its code.** A variant's `title`
   is normally null — the schema computes it from the options — so fifteen Ash
   Overshirt rows all read "The Ash Overshirt" and differed only by
   `ASH-OVERSHIRT-M-OLIVE`. The query now falls back to the option values, so
   rows read "M / Olive". At 360px the product name also wraps instead of
   truncating, because "Linen Shir…" on every row identifies nothing.
3. **The pane had no address.** `/inventory/costing/uncosted` was written INTO
   the address bar when the pane opened but resolved to "That link doesn't open
   anything" when pasted back — I added the surface to the catalog and never to
   `@wizeworks/links`'s route table. `scripts/check-surface-routes.mjs` catches
   exactly this and I had not run it; proved it goes red by removing the entry
   again (`1 surface(s) have no address: inventory.costing.uncosted`).

### Copy fixed after seeing it on screen

- The zero-state callout said the figures "read as zero". They no longer do —
  they read "No cost yet" — so the sentence described behaviour the fix had
  already removed.
- The partial-state title read "354 units here **has** no cost recorded". Now
  agrees, and drops the "here", which was meaningless with every location
  selected.

## Confirmed by — the wider half

> Re-ran as Devi, 2026-08-23, on screen, in dark and light and at 360px.
>
> **Nothing costed.** Stock reports read "What your stock is worth · **No cost
> yet** · 372 units on hand, worth $37,140.00 at your selling prices. What they
> cost you has not been recorded." Amber callout: "Nothing you hold has a cost
> recorded", with **Put in what they cost**.
>
> **Filling it in.** That button opened the new pane: "62 things on your shelves
> — 372 units in all — have never had a cost recorded". Typed $29.00 against the
> Leather-covered belt and $58.00 against two Linen Shirtdresses. The extended
> column computed live — $174.00, $348.00, $348.00 — and the toolbar read "3
> costs typed · adds $870.00 to what your stock is worth". Saved: "3 costs
> recorded · Your value-of-stock figures now count these", and the list dropped
> from 62 things / 372 units to 59 / 354.
>
> **Partly costed — the state that did not previously exist.** Stock reports then
> read "What your stock is worth · **$870.00** · 372 units on hand · worth
> $37,140.00 at your selling prices. **354 units have no cost recorded, so the
> figure above is short by whatever those cost.**" The callout turned from amber
> to info and became "354 units have no cost recorded · The figures above are
> real but short by whatever those cost."
>
> $870.00 is 6 × $29.00 + 12 × $58.00 = $174 + $696. Checked by hand before
> looking.
>
> **Deep link.** `/inventory/costing/uncosted?site=primary` pasted into a fresh
> address bar opens the pane.
>
> **360px.** Columns collapse to Item / You hold / Cost to you, no horizontal
> scroll, the cost box still tappable.

## Rating effect

`Stock › Stock counts` and `Stock › Stock reports` — recorded in
[rating.md](../rating.md). `Stock › What your stock cost you` is new and scored
there for the first time.
