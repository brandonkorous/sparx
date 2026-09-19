# 676 — The figures were cut in half on a narrow pane

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 240
**Surface:** mypiggles — 25 panes across both consoles, found on Stock › Sent back › (a return)
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03, on the screen — see below
**Blocked on:** —

## What happened

Devi had the return open in a narrow window. The three figures across the top:

> **You are owed** $18.00 · **They have credited** **$18.0** · **Credited**
> September 18, 2026

The middle one is not $18.0. It is $18.00 with the last character **sliced off by
the panel's own border**. No ellipsis, no scrollbar, no wrap. A money figure,
silently one digit short.

## Why

`.stats` is an `inline-flex` with `overflow: hidden` — the hidden is there to
clip children against the rounded corners. Each `.stat` inside it is a grid whose
single column is `minmax(0, 1fr)`, and `minmax(0, …)` means the column may shrink
to nothing. So the block has no minimum size to defend, the text overflows it,
and the container clips whatever overflows.

**The console already has the answer, and most of the console uses it.** Nine
surfaces pass a responsive grid to `<Stats>`:

```tsx
<Stats className="grid grid-cols-1 gap-2 px-2 py-1 @2xl:grid-cols-3">
```

which stacks to one column on a narrow pane and goes back to three when there is
room. The others passed `className="w-full"`, which does nothing at all about it.

MEASURED 2026-09-18 across both consoles: **25 call sites** on `w-full` or bare
padding, against 17 already on the responsive grid.

| On the grid                                                                                                                                                                           | On `w-full`                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI overview, Live chat overview, a making run, a recipe, Cost vs plan, Things that do not add up, How it is performing, What your stock cost you, Bookings reports, How your pages do | Automations reports, Ship-direct profit, a shipment, Why this number, Cost to keep, Not selling, At risk, a supplier invoice, Supplier performance, **a return**, Traffic, Owed to you |

## What should have happened

A figure is either readable or absent. Clipping it to a different number is the
one thing it must not do.

## How to reproduce

Before the fix, every time:

1. Sign in as `p03.devi@piggles.test`, Juniper Row.
2. Open any pane in the table above's right column.
3. Narrow the pane (or open three panes side by side, or use a phone). The last
   figure loses characters against the border.

## Why it matters

**A console made of dockable panes makes narrow the normal case.** Nobody has to
be on a phone: three panes open on a laptop is enough, and that is how the
console is meant to be used.

Of the twelve affected panes, nine carry money. "$18.0" is not a smaller way of
writing $18.00, it is a different number, and there is nothing on the screen to
say it has been cut.

## Where it lives

`<Stats className="w-full">` in 25 places across
`piggles|sparx/apps/workbench/surfaces/**`. Full list in the fix below.

## The fix

The house class string, everywhere, chosen by how many figures the row has:

- three figures → `grid grid-cols-1 gap-2 px-2 py-1 @2xl:grid-cols-3`
- four figures → `grid grid-cols-1 gap-2 px-2 py-1 @lg:grid-cols-2 @3xl:grid-cols-4`

`display: grid` overrides the component's `inline-flex`, so the blocks are grid
items rather than flex items and stack rather than compete. No new class, no
override of a silica internal, no change to the component: it is the string nine
surfaces were already using, applied to the twelve that were not.

Left alone: `commerce/reports` in piggles, which builds its blocks from a map and
already carries `flex-wrap`.

**Swept, then diffed.** The change is 25 lines, all of them a `<Stats
className=…>` opening tag, 25 removed and 25 added, nothing else touched in any
file. [[feedback_codemod_diff_your_own_sweep]]

## Confirmed by

> The return, in a 501px window: the three figures now sit one per row — "You are
> owed **$18.00** / at what you paid for these units", "They have credited
> **$18.00** / settled in full", "**Credited** / **September 18, 2026** / their
> ref AM-RMA-118". Nothing clipped.

## Gap to 10

The underlying cause is still in silicaui: `.stats` clips rather than scrolls,
and `.stat` has no minimum of its own. Every call site now avoids it, and a new
one written without the class string will meet it again. Worth raising upstream
with the two changes that would make the component safe by itself — `overflow-x:
auto` on the container and a real minimum on the block.

## Rating effect

Recorded in [rating.md](../rating.md) against the rows for the affected panes as
they are scored. Any Ease score given before 2026-09-18 to a pane with a figures
row was given at a width that read worse than the number says.
