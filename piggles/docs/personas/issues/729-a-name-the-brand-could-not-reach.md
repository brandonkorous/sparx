# 729 — A name the brand could not reach

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 258
**Surface:** mypiggles — the tab and the rail's `+`, on 33 record screens
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: the tab on a purchase order reads "Order to a supplier"
**Blocked on:** —

## What happened

Found while checking [723](723-the-other-half-of-the-rename.md)'s work. The
sentences inside the purchase order pane all say "order to a supplier" now. Its
TAB still said:

> Purchase order

And the `+` on the rail beside **Orders to suppliers** said:

> New purchase order

while the button at the top of that same screen, two clicks away, said
**New order**. One action, two names, depending which one you pressed.

## Why it matters

Both are reached through the catalog, and the catalog has a seam for exactly
this: `vocabulary.ts` renames a screen, `resolveTitle` applies it, and the doc
on `resolveTitle` explains that one lookup covers the rail, the launcher, the
command palette, the tab and the status bar at once.

It had two holes.

**A function title was excluded on purpose**, and the reason is written down:

> A FUNCTION title is left alone deliberately. It is naming a record — "Order
> #1043", a customer's own product name — which is the tenant's data rather than
> the platform's vocabulary, and nothing a brand should be able to rewrite.

**MEASURED 2026-09-19: that is true of 1 of the 33 function titles in the
catalog.** The other 32 look like this:

```ts
title: (params) => (params.id === 'new' ? 'New purchase order' : 'Purchase order');
```

Fixed words, chosen for the other audience, put out of reach by a sentence about
records. [[feedback_a_fix_leaves_its_neighbour_behind]]

**`createLabel` had no seam at all.** It is the tooltip and the accessible name
on the rail's `+`, so it is copy somebody reads, and it was the one piece of the
catalog with nothing between it and the screen.

## What was done

**`resolveTitle` asks the brand first**, function title or not, and the rule
moves to `vocabulary.ts` where the entries live: do not give an entry to a
surface whose title names a RECORD. There is one of those and it has none.

**Seven detail screens named**, each matching the list above it: Special price,
Order to a supplier, Counts from elsewhere, Wholesale customer, Wholesale price,
Automatic email, Person or piece of equipment.

**`createLabels` is a new seam** on the product adapter, beside `surfaceTitles`,
read through `resolveCreateLabel`. Six entries, only where the platform's words
are not ours:

| the rail said       | it says now              |
| ------------------- | ------------------------ |
| Add a price list    | Add a special price      |
| Add a price tier    | Add a wholesale price    |
| Add a trade account | Add a wholesale customer |
| New purchase order  | New order                |
| New broadcast       | New email campaign       |
| Add a source        | Connect somewhere else   |

The catalog is untouched, and deliberately: it is byte-identical between the two
consoles and the whole point of the vocabulary file is that it stays that way.

**A new test, proved red**: four cases covering both halves of the rule, run
against the shipped vocabulary rather than a fixture.

## Files

- `piggles/apps/workbench/lib/surfaces/registry.ts` — `resolveTitle`, `resolveCreateLabel`
- `piggles/apps/workbench/lib/product.ts` — the `createLabels` seam
- `piggles/apps/workbench/lib/console/vocabulary.ts` — 7 titles, 6 create labels, the rule
- `piggles/apps/workbench/lib/console/product.tsx`, `components/panel/nav-row.tsx`
- `piggles/apps/workbench/lib/surfaces/brand-renames-a-function-title.test.ts` — new
- `piggles/apps/workbench/surfaces/commerce/price-lists-list.tsx` — the sentence that defined the old word

## Proof

Put the old `resolveTitle` back: 2 of the 4 new tests fail. Restored: 1,005
tests pass across 111 files.

On screen: the tab on a purchase order reads **Order to a supplier**. Both
typechecks and ESLint clean; `check:screen-names`, `check:piggles-nav` and
`check:console-parity` all pass.
