# 609 — Every row in my stock grid said the same two letters

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · act 207
**Surface:** mypiggles › Stock › Edit a lot at once
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 207 (measured on screen, before and after)

## What happened

I opened **Edit a lot at once** to fix a batch of reorder points. It is the
screen that replaces a spreadsheet, so it is a grid: the item on the left, then
five columns of numbers I can type into.

Every row read:

```
AS…
Th…
```

Fourteen of them on screen, seventy-four in all. Two characters of a product
code and two of a name, then an editable quantity box.

I cannot use that. The rows are not different products, they are **sizes and
colors of the same one**. Eleven of them are The Ash Overshirt. The only thing
that separates `ASH-OVERSHIRT-L-INK` from `ASH-OVERSHIRT-XL-MOSS` is the end of
the code, and the end of the code is exactly the part that was cut off.

So the screen was asking me to type a stock figure into one of eleven identical
rows and trust myself to have picked the right one.

## Why it happened

`workbench/surfaces/inventory/stock-grid.tsx`. The five number columns each
carry a hard floor, with a comment saying why:

```tsx
// `min-w` and not just `w`: a width alone is a SUGGESTION the table drops when
// the row is crowded, and a dropped width here clips "312" to "3" — a number
// that is wrong rather than merely small. The item column gives up space;
// figures do not.
<th key={column} className="w-28 min-w-28 text-right">
```

The item column carried `w-full` and no floor:

```tsx
<th className="w-full">Item</th>
```

`w-full` in a table is not "be wide." It is **"you take whatever is left."**
With every sibling floored and this one unfloored, it did not give up _space_
as the comment says. It gave up **all** of it.

The comment above that line had even predicted the failure:

> the item column collapses to "6a…", which is the one column you cannot edit a
> grid without reading.

It diagnosed the collapse correctly, then fixed only one of its two halves.
`w-full` stops the inputs claiming their intrinsic width. It does nothing at all
once the sum of the floors already exceeds the pane.

## What it measured

Taken on this account, 74 rows, waiting two animation frames after each resize:

| pane width | item column | table overflow |
| ---------: | ----------: | -------------: |
|      320px |    **64px** |          358px |
|      460px |    **64px** |          258px |
|      560px |    **64px** |          252px |
|      700px |    **64px** |          112px |
|      900px |       152px |              0 |
|     1200px |       452px |              0 |

64px is the cell's padding and an ellipsis. It held at 64px across a 580px
range, and it did not widen by a single pixel as the pane grew, because there
was never any slack to take.

The second column of that table is the part that stings. **The grid was already
scrolling sideways.** It had overflowed its card by 358px and given up. Having
given up, it crushed the identity column anyway, so the row paid twice: scroll
to reach the figures, and no way to know which item the figure belongs to.

And the title underneath does not rescue it. Those 74 rows carry **9 distinct
titles** between them. Eight rows share a title on average. The code is the
identity here; the name is the thing they have in common.

## The fix

A floor on the item column, and the code stops truncating.

```tsx
<th className="w-full min-w-56">Item</th>
…
<td className="w-full max-w-0 min-w-56">
  <span className="font-mono text-sm break-all">{row.sku}</span>
  <span className="truncate text-sm">{row.title}</span>
```

56 is 224px. Less 32px of cell padding leaves 192px, and the widest product code
on this account renders at 185px, so it fits on one line even at the floor.
`w-full` is kept, so past the floor the column still grows.

The **code** now wraps and the **title** still truncates, which is the opposite
way round from `uncosted-row.tsx` and deliberate. That screen lists distinct
products, so its title is the identity and its code is a reference. A grid of
stock is mostly variants, so the identity moves to the code and the title
becomes the shared part.

Measured after:

| pane width | item column | code clipped | lines |
| ---------: | ----------: | :----------- | ----: |
|      320px |       224px | no           |     1 |
|      390px |       224px | no           |     1 |
|      560px |       224px | no           |     1 |
|      900px |       224px | no           |     1 |
|     1200px |       452px | no           |     1 |

Seen on screen: `ASH-OVERSHIRT-L-INK`, `ASH-OVERSHIRT-M-MOSS`,
`ASH-OVERSHIRT-XL-INK` and the rest, each in full, each with its own row.

## Guard

`scripts/check-column-floor.mjs`, wired as `pnpm check:column-floor` and a line
in `.githooks/pre-push`.

The rule: **in a file where any table column declares a real `min-w-`, the
`w-full` column must declare one too.**

That narrowness is the whole design of it. About 160 call sites across the two
consoles use `w-full max-w-0` for an identity column and are perfectly fine,
because their siblings can shrink too and the slack is shared. The failure needs
both halves — floored siblings **and** an unfloored absorber — so the check
requires both before it fires. `min-w-0` is not counted as a floor; it is the
opposite, explicit permission to shrink, and counting it would fire on nine
innocent files.

Only three surfaces in 1,182 declare column floors at all, which is why this
went unnoticed: it is a rare enough shape that nobody had met it twice.

Proven red by putting `<th className="w-full">Item</th>` back — it names the
file and the offending class. Proven not-blind by pointing a copy at a
`surfaces-moved` directory, which exits 1 rather than reporting zero problems in
green.

## Why no unit test

There is not one available. A column width is a cascade the browser resolves at
a width nobody develops at. Typecheck, lint and 587 console tests were green
over a 64px column, and a screenshot of a wide pane looks perfect — 900px was
the first width where the column moved at all. A measurement of a rendered table
found it; a text check now holds the rule that prevents it.

## Still open

Nothing from this issue.
