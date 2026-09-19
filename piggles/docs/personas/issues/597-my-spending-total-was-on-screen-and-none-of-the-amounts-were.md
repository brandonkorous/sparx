# 597 — My spending total was on screen and none of the amounts were

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 203
**Surface:** mypiggles › Money › Spending
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P03 · Juniper Row · act 203 (seen on screen)

## What happened

Two screens after [595](595-nine-people-owe-me-and-the-screen-will-not-say-how-much.md),
the same thing, on **Money › Spending**:

> Spending · This month
> **$2,158.70**
> 5 costs

and under it a table headed **Date · What for · Category · Amount**, where the
Amount column sat 47 pixels past the right-hand edge of my pane.

The total was right. 12.50 + 9.40 + 240.00 + 46.80 + 1,850.00 is $2,158.70. I
could see the total and I could not see a single one of the five numbers it is
made of.

## Why it matters

The same reason as 595, and worse for being the second one in a row: a screen
that leads with a money total and then hides the money.

This one also cost me a column I was not told about. At my pane width the
Category column had just appeared, and **that is what pushed the amount off** —
the table gained a column it could not afford and paid for it with the one column
the screen exists for.

## Where it lives

`workbench/surfaces/finance/spending-list.tsx`.

**The cause is not the breakpoints, and finding that out is the useful part of
this issue.** Every table in the console hides columns as the pane narrows, and
that machinery was working. The problem was underneath it: **the table could not
shrink at all.**

The description cell uses the house pattern —

```tsx
<td className="max-w-56 min-w-0">
  <div className="truncate font-medium">{item.description}</div>
```

— and `truncate` is `overflow:hidden` + `text-overflow:ellipsis` +
**`white-space:nowrap`**. Inside a table, that last one is decisive: a column's
minimum width is its content's minimum width, and nowrap text has no minimum
smaller than the whole sentence. So the column demanded the full width of
"Thread, interfacing and buttons, local haberdashery" at every pane size, the
ellipsis never got a chance to appear, and the table simply ran off the edge.

`min-w-0` on the cell does not help. Neither does moving `truncate` from the
`<td>` to an inner `<div>` — I tried that on 595's table first and it changed the
width by **exactly zero**, 507px both ways. The wrapper was never the problem.

**Fixed with one utility.** `truncate` → `line-clamp-2`, which wraps to two lines
and then ellipses. The column's minimum falls to its longest word, and the
reader sees MORE of what the cost was for, not less.

Measured, before and after, in container content-box pixels:

| columns | before (nowrap) | after (wrapping) |
| ------: | --------------: | ---------------: |
|       3 |             450 |          **370** |
|       4 |             600 |          **520** |
|       5 |             721 |          **641** |
|       6 |             800 |          **720** |

The existing breakpoints — Category at `@lg` 512, State at `@2xl` 672, Where from
at `@4xl` 896 — are all correct against the second column. They were all wrong
against the first. **No breakpoint was changed.**

Across eleven widths after the change:

| pane width | columns shown | sideways scroll |
| ---------: | ------------: | --------------: |
|        390 |             3 |               0 |
|        512 |             3 |               0 |
|        560 |             4 |               0 |
|        672 |             4 |               0 |
|        768 |             5 |               0 |
|       1000 |             6 |               0 |

Three, four, five, six. Nothing scrolls sideways from 390px up.

## The lesson, since this is the third in one walk

594 (channels), 595 (owed to you) and this one are one defect wearing three
faces: **a money column at the right-hand end of a table that is wider than the
pane it lives in.** It is always the money, because the money is always last.

What differs is the cause, and guessing at it was wrong twice:

| screen      | what actually caused it                                |
| ----------- | ------------------------------------------------------ |
| channels    | a column that was never added at any width             |
| owed to you | a column admitted at 512 that costs 628                |
| spending    | a text cell that refused to get narrower than its text |

So the thing to measure is not the breakpoints. It is **what the table costs at
each column count**, which is one line of script against the rendered page and
settles all three:

```js
host.style.width = '200px';
table.getBoundingClientRect().width; // what this many columns actually costs
```

## Guard

None that a test can hold — a column's width is a fact about a browser, and this
console's test seat runs no DOM by design. What is written down instead is the
number, in a comment in the file, beside the cell that caused it:

> A `truncate` div keeps `white-space: nowrap`, so in a table it demands the full
> width of its text as the column's minimum however narrow the pane gets — which
> is what pushed the Amount column off the right edge below 600px.

## Still open

**The same `truncate`-in-a-table shape is all over both consoles** — 60-odd `<td
className="… truncate">` cells and four of the inner-div kind. Each one inflates
its table's minimum width the same way. Whether that pushes a column off the edge
depends on the table's total against its own breakpoints, which cannot be read
from the source: it has to be rendered and measured.

Not fixed blind, deliberately. Swapping 60 cells to a clamp with no measurement
is the codemod that breaks seven lists while every check stays green. The three
found so far were found by opening the screen, and the rest of this walk will
keep measuring every table it meets.
