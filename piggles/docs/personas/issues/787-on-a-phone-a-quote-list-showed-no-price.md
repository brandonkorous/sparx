# 787 — On a phone the quote list showed no name and no price

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 277
**Surface:** mypiggles + sparx workbench — `b2b.quotes.list`
**Filed:** 2026-09-23
**Blocked on:** —

## What happened

The table has five columns and hides three of them as the pane narrows:

```
Quote        always
Who asked    @lg
Valid until  @2xl
Total        @xl
Standing     always
```

At a 360px pane that leaves a number and a badge:

```
Q-000017                       Accepted
Q-000016                       Draft
```

A quote is a price. This is the one screen whose entire job is what a job would
cost, and at phone width it printed no price and nobody's name. There is no
hover on a phone, so nothing recovered either.

Same shape as issue 784 on the workflows list, one act earlier, in the same
console.

## What was done

The two facts come back under the number, gated so each returns as soon as its
own column is gone rather than waiting for the widest one:

```
Q-000017                       Accepted
Loom and Larder · $504.00

Q-000016                       Draft
Tamsin Vale · $1,008.00
```

Below `@lg` the line carries who asked and the money. Between `@lg` and `@xl`
the Who asked column is back, so the line carries the money alone. At `@xl` and
up the line is gone and the columns do the work.

## Proof

Host element width set to 360 in injected JS. The browser window was not
resized.

```
hostWidth        360
scrollWidth      360      no horizontal scroll
clientWidth      360
visible headers  Quote, Standing
first row        "Q-000017 · Loom and Larder · $504.00"   Accepted
```

The chips collapse into the toolbar overflow at that width and the search box
takes the full row, which is the house behavior and is fine as built.

## Files

- `piggles|sparx/apps/workbench/surfaces/b2b/quotes-list.tsx`
