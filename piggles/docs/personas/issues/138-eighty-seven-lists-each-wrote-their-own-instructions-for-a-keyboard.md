# 138 — Eighty-seven lists each wrote their own instructions for a keyboard

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 10
**Surface:** mypiggles › the foot of every list, at 390px
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Under the customers list on Nia's phone:

> Click to open · Shift-click to open alongside · Alt-click for a new window

There is no shift key on her phone. No alt key, and no second window. A third of
the footer of every list in the console was instructions for hardware the reader
does not have — and it was set in `text-xs`, 12px, under the 14px caption floor,
in a line nobody could read on the small screen it was uselessly appearing on.

Neither could be fixed, because the sentence was written by hand **87 times**
across 89 files, in five wordings:

| copies | wording                                                                           |
| ------ | --------------------------------------------------------------------------------- |
| 42     | Click to open · Shift-click alongside · Alt-click new window                      |
| 12     | Click to open · Shift-click to open alongside · Alt-click for a new window        |
| 3      | Click to open · Shift-click to open alongside · Alt-click to open in a new window |
| ~30    | the same, with a first clause naming what a row is                                |

Same fact, five sentences, no way to change any of them at once.

## The fix

One component. `<RowOpenHint />` states the contract once, hides itself below
`@md` — the container width where the modifiers exist — and sets the line at the
caption floor. `what` takes the only part that ever varied, which is what a row
IS: `<RowOpenHint what="a supplier to manage it" />`.

86 call sites migrated. Five of them were under-promising as well as
mis-rendering: `dropship/orders-list`, `dropship/products-list`,
`dropship/suppliers-list`, `crm/object-types-list` and `staff/certifications` all
honour alt-click and only advertised shift.

**Two deliberate exceptions.** `studio/emails-list` and `studio/pages-list` name
only shift because they only HONOUR shift — no `altKey` anywhere in either. The
component would over-promise on those two, so they keep their own sentence until
those lists support the third destination like every other list does.

## Where it lives

- [components/row-open-hint.tsx](../../../apps/workbench/components/row-open-hint.tsx) (new)
- 86 list surfaces

## Confirmed by

> Re-ran act 10 as Nia at 390px: no keyboard instructions under any list. Checked
> the same lists on the desktop console: the sentence is there, once, at 14px,
> and the count that used to share the row with it still sits beside it.
