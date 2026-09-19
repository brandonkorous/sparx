# 601 — It told me every job made money, because it had never measured one

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 203
**Surface:** mypiggles › Money › By job
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P03 · Juniper Row · act 203 (seen on screen)

## What happened

**Money › By job** ranks work by margin, so I opened it to see which pieces of
work are worth doing. It said:

> **Every job in this period made money**
> **2 jobs**
> Sort by Worst first to see which came closest to not.

| Job                         |    Made |    Kept | Margin |
| --------------------------- | ------: | ------: | -----: |
| O-000016 Marguerite Adeyemi |  $67.00 |  $67.00 | 100.0% |
| O-000015 Marguerite Adeyemi | $659.00 | $659.00 | 100.0% |

I make clothes. Nothing I sell costs me nothing.

Both jobs read 100% because **not one item in my shop has ever had a cost
recorded** — so "Made" and "Kept" are the same number by construction, every row
ties for first, and the ranking the whole screen exists for cannot mean anything.

The screen one click away says this perfectly, under its own cost-of-goods line:

> Nothing here has been measured yet: 68 things on your shelves, 375 units in
> all, have never had a cost recorded. Until they do, what you make on each sale
> cannot be worked out.

Same module. Same condition. Same data. This screen congratulated me instead.

## Why it matters

This is the screen for deciding what work to take more of, and it is the most
confident sentence in the console sitting over the least evidence. A shop owner
reading "every job made money, 100% margin" concludes her prices are fine.

It is also the worst case of the shape, because an unmeasured zero here does not
make one line wrong — it makes **every row identical and the sort order
meaningless**, on a screen whose only job is to sort.

## Where it lives

`workbench/surfaces/finance/job-profit.tsx`.

**The screen already knew how to do this.** It carries a warning card for a
different soft figure — jobs priced from a list rather than from what was
actually charged — with an icon, a heading and a count. The pattern, the
component and the tone were all sitting in the same file. Cost never got one.

And the reader it needed is the one the profit screen already uses:
`useUncostedStock(1, 0)`, one row, read for its counts.

That is [[a fix leaves its neighbour behind]] for the sixth time this walk, and
the closest neighbour yet: `profit.tsx` and `job-profit.tsx` are the same pane
group, reached by a tab.

**Fixed:**

> **What these jobs cost has not been measured**
> **2 jobs**
> Every one of them shows as pure profit because nothing has been taken off.
>
> ⚠ **These margins are not measured yet**
> None of these margins takes off what the goods cost. 68 things on your
> shelves, 375 units in all, have never had a cost recorded, so every job here
> comes out at 100% and the ranking cannot mean anything yet.

The number also turns from `text-success` to `text-warning`, because a count of
jobs whose margins cannot be trusted is not a green figure.

**A REAL zero is left alone.** A service business has no cost of goods and its
margins genuinely are 100%. The two are told apart by the STOCK and never by the
sum — the same rule `cogs-note.ts` settled on for the profit line, now shared:

| cost of goods | uncosted stock | verdict          |
| ------------: | -------------: | ---------------- |
|          $400 |             68 | measured         |
|         $0.00 |             68 | **not measured** |
|         $0.00 |              0 | measured         |

## The table also ran off the edge

Same walk, same shape as [597](597-my-spending-total-was-on-screen-and-none-of-the-amounts-were.md):
the customer-and-date line under each job used `truncate`, which keeps
`white-space: nowrap`, so the column could never get narrower than
"Marguerite Adeyemi · Sep 5, 2026" and the Margin column went over the right edge
below 440px — 72px over at 360, 42px over at 390.

One utility. `truncate` → `line-clamp-2`. Measured after:

```
320:3  360:3  390:3  440:3  512:3  560:4  620:4  672:4  768:5  1000:5
```

No sideways scroll at any width, including 320, which is better than every other
table fixed this walk.

## Guard

`workbench/surfaces/finance/job-margin-words.test.ts`, 8 tests in each console.

Proven red by reverting `marginsAreMeasured` to `return true` — the state this
replaced — which fails **4 of 8**, including:

```
× is false when nothing was costed and the shelves have no costs on them
× will not claim every job made money when nothing was taken off
```

The two "leave a real zero alone" cases stay green under that break, which is
the point: the guard is testing that it tells the two zeros apart, not that it
returns false.

## Still open

Nothing from this issue.

Worth recording for the punch list: **68 items with no cost is a real gap in
Devi's records**, not just a display problem. Two Money screens now say so and
Stock › What your stock cost you has the box to fix it. That is the product
working, and it is the reason both screens can be honest about the zero.
