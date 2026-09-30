# 692 — A breakdown that did not add up

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 243
**Surface:** mypiggles — Stock › Where this number came from
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen — both states quoted below
**Blocked on:** —

## What happened

The pane is called **How the number breaks down**. Its whole job is to take one
figure apart so a business owner can see where the rest went. Devi opened it on
the buckle from issue 691 and it said:

> On the shelf **1**
> Spoken for **-0** · Nothing is holding any of it.
> Held back **-0** · You are not withholding any as a cushion.
> **Free to sell -1**

One, take away nothing, take away nothing, equals minus one.

## Why

The server computed `sellable` with all four terms and reported only three of
them:

```ts
const sellable = level.onHand - level.allocated - level.safetyBuffer - level.unsellableOnHand;
…
onHand: level.onHand,
allocated: level.allocated,
safetyBuffer: level.safetyBuffer,
sellable,
```

`unsellableOnHand` went into the subtraction and never onto the wire, so the
console could not draw the row even if it had wanted to. The pane rendered the
three terms it had been given and the answer arrived from somewhere it could not
show. [[feedback_fetched_but_never_rendered]], inverted: not a value in hand that
nothing draws, but a value subtracted that nothing was told about.

## Why it matters more here than elsewhere

Everywhere else a missing term makes a number wrong. Here it makes the platform
look broken. A person who is shown a subtraction that does not work does not
conclude "there must be a fourth line" — they conclude the software cannot count,
and then they stop trusting the figures that ARE right.

## What was changed

`StockProvenance` now carries `unsellableOnHand`, and the breakdown has its
fourth row:

> **Not fit to sell** −1
> 1 unit is on a shelf you do not sell from: damaged, in quarantine, or waiting
> to be looked at.

The field is optional on the console type, so an older cached reply reads as zero
rather than blank.

## Confirmed

With one unit held against it, showing a genuinely oversold level:

```
On the shelf       1
Spoken for        -1
Held back         -0
Not fit to sell   -1
Free to sell      -1      1 - 1 - 0 - 1 = -1
```

And after the hold was released:

```
On the shelf       1
Spoken for        -0
Held back         -0
Not fit to sell   -1
Free to sell       0      1 - 0 - 0 - 1 = 0
```

Both add up. The first one adding up to a NEGATIVE is the point: the level really
was oversold, and the pane now says so instead of hiding the reason.
