# 610 — My reorder list got harder to read the wider I made it

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 207
**Surface:** mypiggles › Stock › What to reorder
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 207 (measured on screen, before and after)

## What happened

Straight after [609](609-every-row-in-my-stock-grid-said-the-same-two-letters.md) I
opened **What to reorder**, which is the screen that tells me what to buy. The
one line on it read:

```
The As…
THE-AS…
No sup…
Nothing…
```

Four stacked lines, each cut to about seven characters, next to a box telling
me to order 12 of it.

Then I made the pane wider, and it got **worse**.

## What it measured

The naming column, at each pane width, before:

| pane width | naming column | what had just turned on |
| ---------: | ------------: | :---------------------- |
|      400px |     **229px** | nothing                 |
|      512px |     **140px** | Runs out, At risk       |
|      567px |      **97px** | Available               |
|      640px |         103px |                         |
|      704px |      **64px** | Supplier                |
|      900px |      **64px** | Takes, On the way       |
|     1200px |         314px |                         |

It is readable on a phone and unreadable on a laptop. Every container
breakpoint revealed one more column, and the naming column paid for all of
them. My own pane is 567px, so what I actually get is 97px.

And the table was **already scrolling sideways** at 704 and 900. It had given
up on fitting and crushed the name anyway.

## Why it happened

Same root cause as 609, built out of a different material.

In 609 the sibling columns declared `min-w-28`. Here none of them declare
anything, but nearly all of them are `whitespace-nowrap`:

```tsx
<th className="hidden text-right whitespace-nowrap @lg:table-cell">Available</th>
<th className="hidden whitespace-nowrap @md:table-cell">Runs out</th>
<th className="hidden text-right whitespace-nowrap @md:table-cell">At risk</th>
```

**A cell that may not wrap cannot be narrower than its widest line.** That is a
floor whether or not anyone typed one. Five of them, worth about 450px between
them, against a naming column with nothing holding it up.

The worst of it is the two cheapest to fix. **Runs out** and **At risk** cost
201px together and arrived at `@md` — 448px, the second-narrowest breakpoint
there is. They also **already fold back into the naming cell as badges** below
that width, so turning them on bought nothing at all and cost the name 89px on
the spot.

There is a comment in the file that found this exact bug once already:

> Below @md the Runs out and At risk columns are gone. They were two always-on
> `whitespace-nowrap` cells beside a give-cell, and with the To order number
> they left the NAME 64px in a three-pane layout … A buyer cannot reorder a
> thing they cannot read the name of.

Someone measured 64px, understood it exactly, and fixed the one breakpoint they
were looking at. The same 64px was still there at three wider ones.

## The other half: the location went missing

While measuring, the place a line is short in turned out to appear and vanish:

| pane width | where the location was                                |
| ---------: | :---------------------------------------------------- |
|    < 545px | in the naming cell                                    |
|  545–700px | **nowhere**                                           |
|  704–800px | in the supplier cell, but only if there IS a supplier |
|    > 800px | **nowhere**                                           |

The naming cell hid it at `@lg` to fold it "back out" to a Location column —
and there is no Location column in this table. It folded out to nothing. On
this row, which has no supplier yet, it was simply gone from 567px up.

Juniper Row has two buildings. "Order 12 of this" without saying which one is
short is an instruction with the important word missing.

## The fix

**One home for the location.** It stays in the naming cell at every width, and
the duplicate inside the supplier cell is gone.

**A column may only arrive at the width where it fits.** Costs measured, name
floored at 224px:

| column     | was    | now    |
| :--------- | :----- | :----- |
| Available  | `@lg`  | `@lg`  |
| Sells      | `@xl`  | `@xl`  |
| Supplier   | `@2xl` | `@2xl` |
| Runs out   | `@md`  | `@4xl` |
| At risk    | `@md`  | `@4xl` |
| Takes      | `@3xl` | `@6xl` |
| On the way | `@3xl` | `@6xl` |

**Everything hidden folds back in.** Runs out and At risk already did, as
badges; their fold now matches their new breakpoint. Takes and On the way did
not, so they do now — "Takes 21 days" and "12 already on the way" as lines in
the naming cell. Nothing is lost at any width; it only changes shape.

**And a floor.** `min-w-56` on the naming cell, so no column added later can
starve it again.

After:

| pane width | before |     after | sideways scroll |
| ---------: | -----: | --------: | --------------: |
|      400px |  229px |     229px |               0 |
|      512px |  140px | **341px** |               0 |
|      567px |   97px | **298px** |               0 |
|      640px |  103px | **305px** |               0 |
|      704px |   64px | **229px** |               0 |
|      800px |   64px | **325px** |               0 |
|      900px |   64px | **425px** |               0 |
|     1024px |      — |     347px |               0 |

The sideways scroll is gone at every width as well, which it was not before.

On screen at 567px the row now reads in full: the product, the code, **Main
Warehouse (MAIN)**, "No supplier yet", "Takes 21 days", why the figure is what
it is, and the Out of stock badge.

## The 150 other tables

Two surfaces measured at 64px in one afternoon, from two different causes, so
the third was not going to be found by looking.

`w-full max-w-0` is the house idiom for a naming column: take the slack, and
truncate when there is none. It is on **150 cells across the two consoles**, and
until today not one of them declared a floor. Every one of them is a table where
the naming column is the only column with nothing holding it up.

All 150 now carry `min-w-56`. The floor costs nothing when there is slack — the
column still grows, because `w-full` is kept — and it is the difference between
a readable row and an ellipsis when there is not.

Checked before sweeping: no single table has two slack-taking cells in one row,
so no row gets two floors. The two files with two are `purchase-order-detail`,
where they are the two branches of one ternary and only ever one renders.

Diffed against a copy taken before the sweep: exactly 150 lines changed, all of
them the same string, nothing else touched.

## Guard

`scripts/check-column-floor.mjs`, written for 609 and broadened here.

It reported **green** over this surface, because its first rule only counted a
declared `min-w-`. It now counts `whitespace-nowrap` as a floor too, which is
what this file taught it. Coverage went from 3 surfaces to **207**.

The absorber itself must DECLARE its floor; nowrap does not satisfy it there,
because the whole point of a give-cell is that its text truncates.

Proven red by stripping the floor off `supplier-bills-list.tsx` — it names the
file and the class. Proven not-blind by pointing a copy at a missing directory,
which exits 1.

The idiom, the floor, and why 56, are written down at the top of
`workbench/components/table.tsx`, which every table in the console already
passes through.

## Still open

Nothing from this issue.

Noted, not changed: `reorder-list.tsx` is one file in sparx and four in Piggles
(`-table`, `-cells`, `-body`, `-toolbar`). Same markup, same fix, twice.
