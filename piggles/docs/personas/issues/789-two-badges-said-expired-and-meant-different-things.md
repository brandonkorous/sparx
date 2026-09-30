# 789 — Two badges said "Expired" and meant different things

**Status:** fixed
**Severity:** low
**Found by:** P03 · Juniper Row · act 277
**Surface:** mypiggles + sparx workbench — `b2b.quotes.list`
**Filed:** 2026-09-23
**Blocked on:** —

## What happened

The Standing column draws one of two things, and both could say **Expired**.

One is a stage. The B2B Quotes workflow ships seven of them, and the last is
named Expired:

```
Draft · Submitted · Under Review · Quoted · Accepted · Declined · Expired
```

Its stage type is `void`, so it renders grey.

The other is computed on the row: the quote's own `validUntil` date has gone by
while it still sits on a draft-type stage. That one renders amber.

So the same word, in the same column, in two colors. A person reading it cannot
tell them apart, and the disagreement about the color reads as a bug rather
than as a distinction.

They are not the same fact and they do not want the same thing from her. One is
a quote somebody deliberately closed. The other is a quote nobody has touched
whose price stopped being a promise on its own.

## What was done

The computed one stops borrowing the stage's word and says what actually
happened:

```
Date has passed      amber   the quote ran out while nobody answered it
Expired              grey    somebody moved it to the Expired stage
```

Related, and NOT changed here: `quoteTone('void')` returns `neutral`, which is
shared with the lifecycle and history helpers across 585 call sites in piggles
and 708 in sparx. Declined and Expired are different outcomes wearing one grey.
That is Brandon's call and is carried with the rest of the `neutral` set, not
picked off one pane at a time.

## Files

- `piggles|sparx/apps/workbench/surfaces/b2b/quotes-list.tsx`
