# 565 — Five more tables where the name got 64 pixels

**Status:** fixed and proven
**Severity:** high
**Found by:** Devi, working the way she always does, with three panes open
**Surface:** five `piggles|sparx/apps/workbench/surfaces/inventory/*` tables
**Filed:** 2026-09-16
**Follows:** [557](557-the-item-column-was-84px-and-the-reason-column-was-521.md)
**Family:** [[feedback_a_fix_leaves_its_neighbour_behind]] · [[feedback_responsive_top2_rule]]

## What she saw

Stock → What matters:

> | Item               | Worth         | Demand             |
> | ------------------ | ------------- | ------------------ |
> | Su…<br>SU…         | No cost price | Not enough history |
> | Le…<br>LE…<br>Lit… | Long tail     | Not enough history |

Stock → What to reorder, one row, five stacked lines of two characters:

> Th…<br>TH…<br>M…<br>No…<br>No…

She cannot reorder a thing whose name she cannot read.

## Measured

Her ordinary layout is three panes, so the list pane is about 357px. In that
pane, in each table, the cell holding the name against the widest column beside
it:

| screen                                   | name got  | widest neighbour                  | sideways scroll        |
| ---------------------------------------- | --------- | --------------------------------- | ---------------------- |
| Stock → **What matters**                 | **64px**  | "Not enough history" 164px        | 16px                   |
| Stock → **What to reorder**              | **64px**  | "Out of stock" 123px              | yes                    |
| Partners → **What suppliers billed you** | **84px**  | "Queried with the supplier" 198px | yes, Amount cut off    |
| Stock → **Counting schedules**           | **100px** | "Count now" button 159px          | yes, button off-screen |
| Stock → **Picking walks**                | 192px     | "Waiting for a picker" 165px      | no (tight, left alone) |

## The cause, which is one cause

Every one of these tables has a **give-cell**: `<td className="w-full max-w-0">`
holding the name. In an auto-layout table a `max-w-0` column contributes zero
max-content, so it does not get a share of the width — **it gets whatever is
left after every other column has taken what it wants.**

So any sibling that cannot shrink takes first. Two of them, and there is
nothing left. `whitespace-nowrap` on a badge saying "Not enough history" is a
column with a 164px floor, and it does not care that the product name has none.

**The house already knows this and already fixed it, on the stock list**, whose
comment carries the same measurement this issue opens with:

> _Below @md the State column goes the same way. It was taking 126px of a 360px
> row while the name it describes had 64 and read "Th…"_

The fix there was disclosure: the column disappears below a breakpoint and folds
back under the name as a badge. Five tables never got it.

## The Counting schedules one is worse than narrow

Its notice says:

> 1 schedule is due. Tonight's run will create their counts. Press **"Count
> now"** on a row to do it immediately.

At her pane width that button was **off the right-hand edge**. The screen told
her to press something it had pushed out of reach. Same family as
[561](561-the-notice-quoted-words-the-column-was-too-narrow-to-show.md): copy
that points at a thing a breakpoint has hidden.

## The fix

Disclosure, the way the stock list does it. The badge columns get
`hidden @md:table-cell` and come back under the name in a wrapped badge row, so
nothing is lost, it is only stacked.

What stays always-visible is what the header promises matters: on reorder that
is the name and **To order**; on counting schedules the name and **Count now**;
on supplier bills the invoice and the **Amount**.

## Proven

Same pane, same layout, measured again:

| screen                    | before | after     |
| ------------------------- | ------ | --------- |
| What matters              | 64px   | **341px** |
| What to reorder           | 64px   | **203px** |
| What suppliers billed you | 84px   | **262px** |
| Counting schedules        | 100px  | **197px** |

Sideways scroll on all four: gone (0px). "Count now" is back on screen.
402 piggles tests and 314 sparx tests pass; both consoles typecheck.

## One I tried and put back

**Units of measure** overflows its pane by 148px and the hidden part is the only
action on each row ("Switch off"). Its name cell carries a `truncate` that can
never bite, because the cell is not a give-cell.

Making it one is the obvious fix and **it measured worse**: the name dropped to
78px and the line under it wrapped to one word per line, because the action
column is the real hog at 173px and the second line has no `truncate` either.
Reverted.

The table sits in a sanctioned `overflow-x: auto` wrapper and every cell is
readable, which is what the responsive rule allows. Making it fit needs the
action button to go icon-only below a breakpoint, which is a design decision
about that screen rather than a width bug, and it is worth taking on its own.

## Still open

A source scan finds **23 more tables per console** with a give-cell and two or
more always-visible columns that cannot shrink. Class names cannot say which of
those actually starve — a `whitespace-nowrap` cell holding "58" is harmless and
one holding "Queried with the supplier" is not — so each needs measuring on a
screen with rows in it. The five above are the ones that had rows to measure.
