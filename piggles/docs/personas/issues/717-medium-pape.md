# 717 — "Medium: Pape"

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 251
**Surface:** mypiggles + sparx — the overflow menu on every narrow pane toolbar
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: it reads "Medium: Paperwork", in a panel it now fills
**Blocked on:** —

## What happened

Devi opened **Print a label** beside her purchase order and tapped the pane's
menu. The label-size picker read:

> Medium: Pape⌄

The panel it sat in was 320 wide. The picker was 144.

## Why it matters

The overflow popover is where a control goes when the bar has no room for it.
Arriving there and STILL being cut off is the one thing that place exists to
prevent. And the cut fell on the half that distinguishes the two options:
"Medium: Paperwork" and "Large: Pallets and totes" both start "M"/"L" and the
hint is the part that says which to pick.

The cause is a cap written for a crowded BAR that travelled with the control
into a one-column panel. The popover's own header had already reasoned about
this and reached the wrong answer:

```tsx
// No blanket `w-full` — it would fight the `max-w-xs` wrappers many of
// them carry — but `items-stretch` lets the ones that can, do.
```

They do carry them, and the wrapper won. `items-stretch` cannot widen a child
that has been told `max-width: 9rem`.

The scheduling calendar had already hit this, fixed its own picker, and wrote
the finding down beside it:

> Wide enough for its own default option: at `max-w-40` the picker read
> "Everyone & equip" at every width, **including inside a popover with room to
> spare**.

One call site fixed, the rule not carried. The same shape as
[[716-a-button-with-no-word-on-it]] on the same toolbar.
[[feedback_a_fix_leaves_its_neighbour_behind]]

**MEASURED 2026-09-19** across 372 `controls={…}` regions in the two consoles:
**156 relocated controls carry a fixed width** — 117 on the control itself, 39
on a wrapper div. Read off the live page: panel 320px, content column 288px,
the picker 144px with its own text at 143px and a caret drawn over the end of it.

## What was done

The cap is released in ONE place, the popover's own controls zone, rather than
by teaching 156 call sites a second width:

```
[&>div]:w-auto [&>div]:max-w-none [&_.select]:max-w-none [&_.input]:max-w-none
```

A control keeps whatever width a crowded bar needs, and takes the column when it
is moved into one. Nothing at a call site changes, which is the point: a width
is a property of the place a control is standing, not of the control.
[[feedback_silicaui_single_point_of_change]]

## Files

- `piggles|sparx/apps/workbench/components/pane-toolbar-overflow.tsx`

## Proof

Measured in the live page before and after, same pane, same window:

| control              | before | after |
| -------------------- | ------ | ----- |
| Medium: Paperwork    | 144px  | 287px |
| 2 copies             | 112px  | 287px |
| Print (already full) | 287px  | 287px |

Checked on three more popovers with no layout change anywhere else: the purchase
order list (two pickers), Every change (two pickers and two date fields), and the
label pane. Both consoles typecheck; ESLint and Prettier clean.
