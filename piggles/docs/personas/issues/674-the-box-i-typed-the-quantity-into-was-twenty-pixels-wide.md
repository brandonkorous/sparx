# 674 — The box I typed the quantity into was twenty pixels wide

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 240
**Surface:** mypiggles › Stock › Sent back › Send something back, and Enter their invoice
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03, on the screen — see below
**Blocked on:** —

## What happened

Devi added the roll of stained linen to a return. The row appeared:

| Item                                   | Going back | Paid each |
| -------------------------------------- | ---------- | --------- |
| Linen, natural, 200gsm `LINEN-NAT-200` | `'`        | `W`       |

Those are not typos. **Going back** held a `1` and rendered about twenty pixels
wide, so what showed was a sliver of the digit that reads as an apostrophe.
**Paid each** showed the first letter of its own placeholder. She could not read
the quantity she was returning, and there was nothing on the screen to suggest it
was a number at all.

## Why

The item cell is the give-cell: `w-full max-w-0 min-w-56`. In a table `w-full`
does not mean "be wide", it means **"you take whatever is left"**. Beside it the
number cells carried no width, on the cell or on the input — and an input has no
text of its own to hold it open, so the input is what collapses.

`check-column-floor` already guards the mirror of this: it exists because the
give-cell itself was crushed to 64px on a real account of 74 rows. It only ever
looked at the give-cell. The cells that crush it were never checked.
[[feedback_a_fix_leaves_its_neighbour_behind]]

**The idiom that works is in the same folder.** Receiving writes
`className="w-20 text-right tabular-nums"` on its "Received now" box. Recipes
write `w-24`. Neither of the two forms below had anything.

MEASURED 2026-09-18 across both consoles: **four** input cells beside a give-cell
with no width anywhere.

| Screen                 | Boxes                                                      |
| ---------------------- | ---------------------------------------------------------- |
| Send something back    | how many are going back, what you paid each                |
| Enter their invoice    | quantity billed, price each                                |
| Counting (count lines) | the counted quantity — `max-w-24`, a ceiling with no floor |

## What should have happened

A number somebody types is a number somebody can read back.

## How to reproduce

Before the fix, every time:

1. Sign in as `p03.devi@piggles.test`, Juniper Row.
2. **Stock › Sent back › Send something back**, choose a supplier and a location,
   type any item code and press Add.
3. The Going back box is a sliver.

## Why it matters

The invoice form is the worse of the two. **Enter their invoice** is where a bill
gets checked, line by line, against what was ordered and what arrived, before it
is paid — and the two boxes that carry the check were the two that could not be
read. A quantity you cannot read is not a smaller field, it is a wrong one: `1`
and `11` look identical when both are clipped to a stroke.

## Where it lives

| What                                 | Where                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| The return's two boxes               | `piggles\|sparx/apps/workbench/surfaces/inventory/supplier-return-detail.tsx` |
| The invoice's two boxes              | `…/supplier-bill-new.tsx`                                                     |
| A ceiling instead of a floor         | `…/count-lines.tsx` (piggles), `…/count-detail.tsx` (sparx)                   |
| The guard that only watched one side | `scripts/check-column-floor.mjs`                                              |

## The fix

**Widths, the way the folder already does it.** `w-20 text-right tabular-nums` on
the quantity boxes, `w-28` on the money ones. The count screens had `max-w-24`,
which is a ceiling and not a floor — it caps the box and does nothing to stop it
being squeezed under that — so they became `w-24`.

**The guard now watches both sides.** `check-column-floor` gains the mirror rule:
in a table that has a give-cell, a control in a cell declares a width, on the
cell or on itself. `w-full` on the control does not count, because filling a cell
that is itself zero wide is still zero wide.

It is tested **per table**, not per file. The first run reported `stock-import`,
whose mapping grid has no give-cell at all — the `w-full` is in a different table
further down the same file. Two false alarms in the first run were `/[",\n]/.test(s)`
read as a count of tests, because the character class opens with a quote; the
word before `(s)` may no longer follow a dot. This file argues twice that a false
alarm is how a check gets switched off, so both were fixed rather than tolerated.

**Proved red.** Removing the width from the return's quantity box again reports
exactly that one cell and exits 1.

## Confirmed by

> The return row now reads "Linen, natural, 200gsm / LINEN-NAT-200 — **Going
> back: 1** — **Paid each: What you pai…**", both legible, and the return was
> completed through to a recorded credit.

## Rating effect

Recorded in [rating.md](../rating.md) on the
`inventory.supplier-returns.detail` and `inventory.supplier-bills` rows.
