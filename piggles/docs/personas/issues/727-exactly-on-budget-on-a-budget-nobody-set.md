# 727 — Exactly on budget, on a budget nobody set

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 257
**Surface:** mypiggles + sparx workbench — Cost vs plan
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: all three figures read "Not known" while the banner carries the real $1,083.12
**Blocked on:** —

## What happened

Opened **Cost vs plan** to see whether her suppliers had been holding their
prices. The card at the top of the screen said:

| What you planned to pay        | What it actually cost                    | The difference                             |
| ------------------------------ | ---------------------------------------- | ------------------------------------------ |
| **$0.00**                      | **$0.00**                                | **$0.00**                                  |
| Across 0 of 106 units received | Goods plus freight, for those same units | Nothing here had a plan to compare against |

Three zeros, on a business that had taken in 106 units of cloth and hardware.
Under them, an amber banner that knew perfectly well what had happened:

> 106 units have nothing to compare against. That stock has no planned cost set,
> so it is left out of the figures above. **Everything that arrived cost
> $1,083.12**, and there is no plan to weigh it against.

## Why it matters

The card reads as a clean bill of health. Planned nothing, spent nothing, came
in exactly on budget. What actually happened is that she spent a thousand
dollars and nobody had written down what it was supposed to cost.

All three figures are sums over the units that HAVE a planned cost. With none of
them, they are arithmetically zero and meaningless.
[[feedback_never_present_absence_as_measurement]]

**The file had already worked this out**, about the small print. Beside the
third stat:

> `"Exactly what you planned for" over a business that planned NOTHING is the
same zero meaning two opposite things.`

That note is attached to the sentence UNDER the number. The sentence was fixed.
The number above it, in 24px bold, went on saying $0.00.

And the sibling screen answered the same question the other way. **The recipe
pane** prints **"Not known"** rather than $0.00 when no part has a cost, which is
issue [690](690-a-recipe-that-cost-nothing-to-make.md), filed against this same
module. [[feedback_a_fix_leaves_its_neighbour_behind]]

## What was done

All three figures read **"Not known"** when nothing was compared, in both
consoles, matching the wording the recipe pane, the recipe list, the books
reconciliation and the sign-in check already use.

One sub-line moved with it. "Goods plus freight, for those same units" describes
a scope of zero units, and it sat directly above a banner that does know the
real total, so it now reads **"Nothing here to add up"** and lets the banner
carry the figure.

Nothing else on the pane changed, and nothing needed to: the banner already
names the cause, says what it costs her, and carries a button — **Put in what
they cost** — that opens the bulk entry screen with all 68 items and a box each.
That is a named remedy with a path, and it works.

## Files

- `piggles|sparx/apps/workbench/surfaces/inventory/cost-variance.tsx`

## Proof

On screen, Juniper Row with 106 units received and no planned costs: **Not
known · Not known · Not known**, over "Across 0 of 106 units received", "Nothing
here to add up", "Nothing here had a plan to compare against", over a banner
reading "Everything that arrived cost $1,083.12". Before the change, the same
data read $0.00 three times.

1,001 piggles tests and 875 sparx tests pass; both typechecks and ESLint clean.
