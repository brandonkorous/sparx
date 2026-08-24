# 173 — She was sent to the product for a panel that is not on it

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 3
**Surface:** mypiggles › Stock › (empty state) · Stock › Count · Stock reports · Reorder
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** two counts started as Devi — the toast now matches the list in both directions — below

## What happened

Devi had seven products priced and no stock. She opened **Stock**, which said,
on an otherwise empty screen:

> **Nothing is being counted yet**
> Stock appears here once you record how many of something you have. **Open a
> product and use its Stock panel to count it for the first time** — and until
> you do, your website sells it without limit.

So she opened a product. Its tabs are Overview · Options · Variants · Media ·
Details · Pricing · SEO. She expanded a version on Variants, which is the next
most likely place, and got price, cost, code, barcode, run-out policy and "Stop
selling it" — no quantity anywhere.

**The panel is real.** It is `commerce.product.stock`, it is listed, and it is
very good — "To sell / On the shelf / Spoken for", a card per version with a row
per location, the movement history, a reorder-rule prompt, and a **Record a
count** button. What it is not is a tab on the product, deliberately and for a
stated reason: product facets are dockable panes so they sit beside the product
rather than inside it, and the registry comment says so in as many words.

So the sentence sends her to the one place the panel is not, and calls it by a
name it is not listed under. In the launcher it is **"How many you have"** —
searching "stock" returns seventeen other things ahead of it, and does not show
it at all without scrolling. Searching "how many" finds it at once, which is not
a phrase the empty state ever puts in her head.

## What should have happened

The empty state names the thing the way the console names it, and offers the
action rather than describing a journey. From zero stock, the useful action is
starting a count — that is what actually got Devi's 62 items in — with the
per-product panel as the narrower option.

## How to reproduce

Every time, on any tenant with products and no stock.

1. Console → **Stock**. Read the empty state.
2. Follow it: **Sell → Products →** open any product. No Stock among the seven
   tabs; no quantity on an expanded version.
3. Command palette → "stock". "How many you have" is not in the visible list.
4. Command palette → "how many". There it is, and it works.

## Why it matters

This is the first sentence an owner reads about stock, on the screen that has
just told her **her website is selling without limit**. She is motivated, she
does exactly what it says, and the thing it names is not where it says.

The reading from her side is "I must be missing something", and what usually
follows is not a hunt through a five-step setup she has not opened — it is
leaving stock alone. Which is the one outcome the sentence's own warning says
costs her money.

Major because a sentence on screen is false about where something is, and
because the panel it is pointing at is good enough that not finding it is a real
loss.

## The other half — the first count is a locked room

Having found **Stock → Set up your stock → Count what is actually there → Open
counts → Start a count**, Devi hit a second wall built the same way.

The new-count form offers "Everything kept at this location", described as
_"Every item with stock here is listed for you to count, ready to go."_ She has
no stock anywhere, so that list is empty. She pressed on and got:

> **Count started at Main Warehouse**
> Every item kept here is ready to count.

over a screen reading **0 items** and **"No items on this count yet"**. The
sentence describes a full list; the list is empty. Same shape as [[175]] — a
message asserting a state nobody measured.

Then the control literally labelled **"Add an item to count"** could not add any
of her items:

> Nothing here matches that, or everything matching is already on the count.

Its search is scoped to "the items kept at this location", and nothing is kept
anywhere yet, so searching `Ash` on a shop with fifteen Ash Overshirt versions
returns nothing.

**What does work** is the box directly above it, "Scan what you find", whose
description is the accurate one: _"Anything not already on the list gets added to
it."_ Typing `ASH-OVERSHIRT` and pressing Enter put it on the count immediately.

So two adjacent controls on one card behave oppositely: the one named for adding
items cannot reach a new item, and the one named for scanning reaches every item
in the shop. Whichever is right, they should not disagree on the same card.

**The job did complete this way** — 62 versions added by code, each set to 6,
saved, finished and applied behind a confirm that named the number and the place
and said plainly it could not be undone. The machinery is good. Every wall in
this issue is a sentence pointing the wrong way.

## Where it lives

- The empty state:
  [stock-list.tsx](../../../apps/workbench/surfaces/inventory/stock-list.tsx).
  Note that the SEARCHED empty state a few lines above already does this right —
  it names the matching products and gives a button that opens the panel. Only
  the bare state is prose with no action.
- The same "use its Stock panel" phrasing again in
  [reports.tsx](../../../apps/workbench/surfaces/inventory/reports.tsx).
- The toast and the two search descriptions:
  [count-detail.tsx](../../../apps/workbench/surfaces/inventory/count-detail.tsx).
- The panel itself:
  [product-stock.tsx](../../../apps/workbench/surfaces/commerce/product-stock.tsx),
  registered in
  [commerce-product-panels.ts](../../../apps/workbench/lib/surfaces/catalog/commerce-product-panels.ts).
  Nothing wrong with either — they are here so the fix points at the right thing.

## The fix

Made. Nothing here needed a decision, which is why `Blocked on:` is absent.

1. **The Stock empty state** stops describing a journey and offers the action,
   the way its own searched state already did: **Count what you have** (opens
   Stock counts) and **How many you have** (opens the panel beside the product),
   under a description that no longer says where anything lives.
2. **The count-started toast** counts the lines it actually created —
   `startedDescription` in `count-start.tsx`.
3. **The "Everything kept at this location" description** says what will be
   there rather than what is hoped for.
4. **"Add an item to count"** is now **"Add something already counted here"**,
   says it searches what already has stock at this location, and both its
   description and its empty result point at the scan box for anything new. The
   scan card says the matching thing from its side: "even if it has never been
   counted here."

5. **The same sentence in two more places, now closed.** A sweep for the phrase
   found it was not one instance but three. `reports.tsx` had "Open a product and
   use its Stock panel to record how many you have" on Stock reports' empty
   state, and `reorder-list.tsx` had "Open a product, and on its Stock panel set
   a reorder level and how many to buy" on the no-rules state. Both now name the
   pane the way the launcher does and put a button on it. Neither pane was opened
   as Devi, so both are **fixed but not seen** — the copy is right in the source
   and typechecks, and it is not scored until somebody looks at it.

   Two comments in `data.ts` and `receiving-data.ts` also say "the product's
   Stock panel". Those are accurate — the panel does belong to a product — and
   they are comments, so they stay.

Applied piggles RULE #0.5 on the way past, since both files were over the line:

- `stock-list.tsx` 525 → 248, plus `stock-list-empty` (167), `stock-list-table`
  (170), `stock-list-toolbar` (107).
- `count-detail.tsx` 1155 → 107, plus `count-start` (218), `count-session`
  (228), `count-toolbar` (160), `count-lines` (199), `count-actions` (189),
  `count-add-items` (173), `count-notice` (53), `count-shared` (21).
- `reports.tsx` 1041 → 117, plus `reports-column` (134), `reports-value` (180),
  `reports-ageing` (172), `reports-shrinkage` (189), `reports-movement` (110),
  `reports-asof` (131), `reports-card` (72), `reports-toolbar` (103),
  `reports-empty` (63), `reports-queries` (44), `reports-shared` (64).
- `reorder-list.tsx` 642 → 116, plus `reorder-list-table` (130),
  `reorder-list-cells` (131), `reorder-list-toolbar` (176),
  `reorder-list-body` (67), `reorder-list-footer` (65), `reorder-window` (104),
  `reorder-selection` (128), `reorder-draft-bar` (40),
  `reorder-list-empty` (82), `reorder-shared` (42).

Rule #0.5's SECOND clause was applied properly this time: no function in any of
those files is over 50 lines. Six report cards shared a hand-repeated header
block, which is now one `ReportCard` — a change to the house card used to mean
finding six places.

Four `color="neutral"` call sites were dropped rather than carried into the new
files — the Save button, the print button, the remove-line button and the
reorder list's Clear button are now colorless, which is what root RULE #4 asks
for and needs no approval.

## Confirmed by

**Started two counts as Devi, one at each of her locations.**

At **Fulfillment Center**, which has nothing:

> **Count started at Fulfillment Center**
> Nothing has been counted here before, so the list starts empty — scan or type
> a code to put the first item on it.

over a pane reading `0 items` and "No items on this count yet — Scan or type a
code above to put the first item on it."

At **Main Warehouse**, which now holds her 62:

> **Count started at Main Warehouse**
> 62 items are ready to count.

over `62 items · 0 of 62 items counted`. Both sentences now describe the list
under them, which is the whole of this issue.

The two cards read correctly on both: "Scan what you find … even if it has never
been counted here", and "Add something already counted here — Searches what
already has stock at this location. For anything else, use the scanner box above
— typing a code there works too."

Both test counts were then discarded, which also exercised the discard confirm
("Nothing on your shelves changes … This cannot be undone").

**The Stock empty state itself was NOT re-proved on screen.** Her shop now has 62
counted items, so the bare state cannot be reached without destroying that, and
narrowing by location shows the "nothing matches" state instead. The change is
in `stock-list-empty.tsx` and typechecks; it has not been seen (RULE #4).

Seen in dark at full width and at 360px. **Light not checked** — the appearance
menu is the one the harness cannot activate (see [[171]]), and script access to
the stored preference is blocked in this session.

## Rating effect

`Stock › (empty)`, `Stock › Count` — recorded in [rating.md](../rating.md).
