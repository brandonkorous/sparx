# 475 — All 72 lines ranked "Long tail", because not one of them had a cost price

**Status:** fixed
**Severity:** major
**Found by:** counting the badges on "What matters most" instead of reading them
**Surface:** `inventory.planning.classes` (both consoles) · `@wizeworks/inventory` classification
**Filed:** 2026-09-09

## What was wrong

"What matters most" answers "where is the money in my stock". Devi's, counted in
the live DOM rather than eyeballed:

```
rows: 72
Worth:  { "Long tail": 72 }
Value a year: $0.00 on all 72
Share:        0.00% on all 72
```

Every line, the same answer, at the bottom of the ranking. And the pane's own
banner told her to trust it:

> **The left-hand column is real** — it ranks your stock by what you actually use
> in a year, and that only needs totals.

It is not real, and it needs more than totals. Worth is **units used × what a
unit cost you**, and an unrecorded cost has to enter that multiplication as a
zero for the arithmetic to run at all. So every unpriced line scores nothing,
ties with every other unpriced line, and lands in C.

**Three of Devi's 72 stock lines have a cost price. Of the 17 lines that have
actually sold something, none do.** The entire ranking was computed on absent
data and presented as a finding, on the one screen whose job is to tell her
where to spend her attention.

## The neighbours had already solved this

The XYZ half of the same pane gets it exactly right, and the database column
says why at length:

> _"Nullable rather than defaulted, and that is the whole point: the column used
> to default to 'Z', so a catalogue nobody had sold from yet reported every line
> as erratic … the screen ends up advising 'order little and often' on the
> strength of nothing. NULL says unmeasured, which is the honest answer."_

That paragraph sits **four lines below** `abcClass String @default("C")`.

The slow-mover report next door carries a `costKnown` flag for the identical
COALESCE, with the identical reasoning written above it:

> _"A hundred notebooks reading $0.00 is a wrong answer; 'No cost set' is the
> right one and points at the fix."_

Two panes away, "Cost to keep" says _"68 items have no cost price"_ in an amber
banner. Only this one was silent.

## The fix

`ClassificationRow` gains `costKnown`, read at query time from the same COALESCE
chain valuation uses, so the three cannot disagree about whether a cost exists.
It is read rather than stored, because the answer changes the moment somebody
fills in what they paid.

On the screen, matched to the Demand column beside it:

| before                    | after                                          |
| ------------------------- | ---------------------------------------------- |
| `Long tail`               | `No cost price`                                |
| `$0.00`                   | `No cost set`, with the reason on hover        |
| `0.00%`                   | `—`                                            |
| advice from the fake pair | nothing, because there is no pair to advise on |

Plus a count above the table — _"69 items have no cost price"_ — and, if not one
line has a cost, a stronger message ahead of the steadiness one, because
"neither column can rank anything yet" outranks "worth is fine, steadiness is
not".

The banner that said the column "is real" no longer says it. It now says what
the column needs, so it stays true whether the costs are there or not.

An override still shows: a person answering the question is an answer.

## Deliberately NOT done, and why

The symmetric fix is to make `abcClass` nullable the way `xyzClass` already is,
so the sweep records "cannot rank" rather than writing a C. That needs a
migration, and migrations in this repo are authored and handed off rather than
applied from here. The stored letter is an internal ranking artifact; the screen
is the product, and the screen no longer asserts it. Worth doing when a
migration is being cut anyway.

| breaking                    | reddens |
| --------------------------- | ------- |
| pinning `costKnown` to true | 1       |

## Proven

The live screen, on her data: 69 rows read `No cost price / No cost set / —`,
and LEATHER-BELT — one of the three that HAS a cost, and genuinely used none of
it this year — still reads `Long tail / $0.00 / 0.00%`, which is a real zero and
a real finding. The two are now distinguishable, which is the whole point.
