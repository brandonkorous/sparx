# 773 — The only thing you can do to a row was off the right edge

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 273
**Surface:** mypiggles + sparx workbench — `inventory.movements` ("Every change")
**Filed:** 2026-09-22
**Blocked on:** —

## What happened

Scoring the stock movements pane at 360px, which RULE #6 requires before a pane
is scored at all. In the pane it reads well: When, Item, Change, Left on shelf,
Why, Location, and a shield button per row that opens **Where this item's number
stands now** — the one thing a person can do to a row other than open the item.

At 360px the table collapsed the way it is built to: four columns fold into the
Item cell, the rest hide. Then it ran off the edge anyway.

```
table 390px   inside a 318px body   →  72px behind a sideways drag
cells: item 224 · change 88 · explain 78
```

The 72px was the whole explain column. So on a phone the row's only action was
not small, or awkward — it was **not there**, with no header word beside it, no
hint that the list scrolls sideways, and a custom scrollbar that reads as part
of the pane's frame. Dragging over to it then cut the product name from the
LEFT: `…atural, 200gsm`, `…ELT-1`.

## Why the pane was right and still did this

The Item cell is the one that GIVES — `w-full max-w-0`, so it receives whatever
is left after the fixed columns take what they want. Its own header comment says
so, and `check:column-floor` exists because an unfloored give-cell once rendered
at 64px on a real account.

So it carries a floor: `min-w-56`. 224px.

**A floor and a give-cell are the same cell here, and at 360px they fight.**
318px of body, less 88px of Change and 78px of the explain column, leaves 152px
— below the 224px floor. The cell stopped giving, and the table simply grew
past its box. A floor that forces a sideways scroll is not protecting the column
it is on; it is moving the damage somewhere nobody looks.

Nothing could have caught it. `check:column-floor` passes — the floor IS
declared, which is the whole of its rule. Typecheck, lint and 1,185 tests pass
on a column width, because a column width is a cascade the browser resolves at a
width nobody develops at. It took measuring a rendered table at 360px.
[[feedback_test_as_a_business_owner]]

## What it costs

Devi does stock in the stockroom, on her phone, which is the width this is. The
button she cannot reach is the one that answers "why does this say 44 when I
count 46" — the single question a movements list exists to settle. Without it
the pane is a list of numbers with no way in.

## What was done

**The floor rises with the width**: `min-w-28 @sm:min-w-56`. A real floor at
every width, and at the narrowest one it is low enough that the give-cell can
still give.

**And the explain button moved** rather than keeping a column of its own down
there. A column cost 78px of a 318px row to hold a 32px icon; the row is already
four lines tall at that width, so it now rides under the change badge, where
vertical room is the cheap kind. Its own column returns from `@sm` up.

`StandsNow` was extracted so the two placements are one definition and the
label a screen reader announces is written once. One is displayed at a time.

Measured after, same pane, same width:

```
table 318px   inside 318px   →  no sideways scroll
cells: item 198 · change 88          one visible explain button per row
```

The Item cell went 152 → 198px, so the product name, its code and the reason are
all readable where before all three were cut. Pressing the button at 360px opens
the provenance pane, which is the proof that mattered.

Still truncated at that width: the location (`Main War…`, `Fulfillment…`). It is
the least load-bearing of the four folded-in facts and the room is genuinely not
there. That is this pane's gap to 10.

## Files

- `piggles|sparx/apps/workbench/surfaces/inventory/movements-list.tsx`

## Proof

Before, at a 360px pane:

```js
> const t = document.querySelector('.piggles-dock-host table');
> ({ table: t.getBoundingClientRect().width, box: t.parentElement.clientWidth })
  { table: 390, box: 318 }
```

After, unchanged otherwise:

```js
  { table: 318, box: 318 }
```
