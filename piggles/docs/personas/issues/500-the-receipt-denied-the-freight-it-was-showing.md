# 500 — The receipt denied the freight it was showing

**Status:** fixed and proven
**Severity:** minor
**Found by:** Devi, on the delivery that proved [497](497-freight-is-not-shipping.md)
**Surface:** the delivery detail, both consoles
**Filed:** 2026-09-09

## What she saw

The receipt that finally proved the landed cost said both of these things, about
four inches apart, on one screen:

> **$36.00** what the goods cost · **$1.25** getting them here, 3.4% of the
> total · **$37.25** what this stock is worth to you

> Nothing has been recorded on top of the supplier's invoice.

## Why

The charges card lists costs recorded **against this delivery**. Nobody added
one, so its empty state fired. But $1.25 _had_ landed here — this delivery's
share of the freight on the order, apportioned by
[497](497-freight-is-not-shipping.md) and printed by the card immediately above.

The empty state was answering a narrower question than the sentence it wrote.
"Nothing has been recorded here" is true; "nothing has been recorded on top of
the supplier's invoice" is not, and it is the second one a person reads.

This is [496](496-the-25-dollars-of-carriage-she-typed-never-reached-what-the-linen-cost.md)
in a mirror. There, a card claimed nothing was expected while $25 of carriage sat
on the same screen. Here, a card claims nothing was recorded while $1.25 of it
sits on the same screen. Fixing the first one created the condition for the
second, which is worth noticing: **an empty state is a claim about a scope, and
widening what can land in that scope makes the old sentence false.**

## What changed

The value was already in the component's hand — `receipt.chargeTotalCents` is
what draws the $1.25 in the summary. The empty state now branches on it:

**When freight landed here but nothing was added:**

> Nothing has been recorded against this delivery on its own. The $1.25 above is
> its share of the freight on the order, spread across the items as they
> arrived. If a customs or duty bill turns up for this delivery, add it here and
> every item's cost is corrected.

**When genuinely nothing landed** — the original sentence, unchanged.

## Proof

Seen on GR-000002 on 2026-09-14, on the delivery that carries $1.25 of the
order's freight and nothing of its own:

> Nothing has been recorded against this delivery on its own. The $1.25 above is
> its share of the freight on the order, spread across the items as they
> arrived. If a customs or duty bill turns up for this delivery, add it here and
> every item's cost is corrected.

The other branch was proven the same day on GR-000003, which has a cost of its
own and so shows the charge rather than either sentence.

## One thing the first draft got wrong

It rendered as **"The $1.25above is its share"**. The space is in the source, and
the same JSX shape renders its space correctly elsewhere in the same console, so
it was not something a reading would have caught. An explicit `{' '}` fixes it.

Worth recording because of what found it: not the typecheck, not the lint, not
the 1,300 tests. Looking at the sentence on the screen.
