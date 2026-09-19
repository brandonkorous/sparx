# 557 — The item column was 84px wide and the reason column was 521

**Status:** fixed and proven
**Severity:** medium
**Found by:** Devi, trying to read what had changed on "Every change"
**Surface:** `piggles|sparx/apps/workbench/surfaces/inventory/movements-list.tsx`
**Filed:** 2026-09-16
**Family:** [[feedback_responsive_top2_rule]] · [[feedback_a_fix_leaves_its_neighbour_behind]]

## What she saw

Stock → **Every change**, the ledger of every movement in the shop. The Item
column read:

> `Bras…`
> `BRASS…`

Every row the same. Three characters of the product name and five of the code, on
a screen whose entire purpose is to say **which** thing changed and why.

Meanwhile the **Why** column, whose most common value is the single word
"Damaged", had 521 pixels.

## Measured

```js
[...table.querySelectorAll('thead th')].map((th) => th.getBoundingClientRect().width);
```

| column        | before  | after   |
| ------------- | ------- | ------- |
| When          | 122     | 122     |
| **Item**      | **84**  | **317** |
| Change        | 88      | 88      |
| Left on shelf | 68      | 68      |
| **Why**       | **521** | **288** |
| Location      | 151     | 151     |

47% of the table was going to a column holding one word, and the widest text on
the screen was being shown three characters at a time.

## The cause

The Item cell is the one that GIVES:

```tsx
{/* `max-w-0 w-full` makes this the cell that gives, so the product
    name truncates instead of shoving the Change column off the
    right edge. */}
<td className="w-full max-w-0">
```

The comment is right about the intent and silent about the consequence. In an
auto-layout table, `max-width: 0` sets that column's maximum content contribution
to nothing, so it does not _share_ the room — **it receives whatever is left over
after every other column has taken what it wants.** Arithmetic on the measured
row: `1112 − 122 − 88 − 68 − 521 − 151 − 78 = 84`.

Every other column was capped. `Location` carries `max-w-48`; `When`, `Change`
and `Left on shelf` are `whitespace-nowrap` short. `Why` had no width at all, so
it quietly became the give-cell instead, and Item got the crumbs.

## The part that is worse than narrow

At a docked pane of 400px the table could not shrink either:

| pane  | table width, before | after     |
| ----- | ------------------- | --------- |
| 400px | **752px**           | **390px** |

`Why` demanded 521px whatever the pane did, so the table was 352px wider than the
pane that held it. The `@container` breakpoints on this table exist precisely to
avoid that: they drop When, Left on shelf and Location on a narrow pane so the
three that matter still fit. One uncapped column defeated all of them, and the
sideways scroll they were written to prevent appeared anyway.

## Swept

Every `.tsx` in both consoles that uses the `w-full max-w-0` give-cell idiom, for
a sibling `<td>` with no width class that can hold a sentence:

```
unconstrained cells that can hold a sentence: 6
  {piggles,sparx}/…/inventory/movements-list.tsx      ← the fault
  {piggles,sparx}/…/inventory/purchase-order-detail.tsx
  {piggles,sparx}/…/inventory/receipt-detail.tsx
```

The last two are false positives: their uncapped cell is in the **charges** table,
which has no give-cell of its own, so it is the intended give-cell there. The
idiom is used in 48 files and is correct in 47 of them.

## The fix

One class, and the rule written down beside it.

```tsx
{/* CAPPED, and that cap is load-bearing. The Item cell above is the one that
    GIVES (`w-full max-w-0`), which in an auto-layout table means it receives
    whatever is left after every other column has taken what it wants. So an
    uncapped text column here does not share the room, it takes it … Any column
    added beside a give-cell needs a width. */}
<td className="max-w-40 @xl:max-w-72">
```

Responsive on purpose. 288px at a normal pane leaves Item 317px, which fits
"Brass belt hardware, antique" whole. 160px on a narrow pane keeps the table at
390px instead of 752px, and lets the reason wrap to two lines rather than
truncate, because the reason is the column's point and there are only fourteen of
them.

## Proven

Her rows now read **Brass belt hardware, antique / BRASS-BELT-1**, **Linen,
natural, 200gsm / LINEN-NAT-200**, **The Ash Overshirt / THE-ASH-OVER-M-SLATE**.
Measured at four pane widths (full, 400, 390, 360); the table fits at 400 and
overflows by 47px at 360, which is the horizontal-scroll wrapper doing its job
rather than the layout failing.

Both consoles typecheck; 383 piggles and 295 sparx tests pass.
