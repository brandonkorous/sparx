# 725 — A commitment appears here

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 256
**Surface:** mypiggles — Waiting for stock, Owed, Preorders
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: the empty state reads "Somebody appears here the moment you take an order the shelf cannot cover"
**Blocked on:** —

## What happened

Opened **Waiting for stock**. Empty, and the sentence under the picture read:

> Nothing has ever had to wait for stock. **A commitment** appears here the
> moment you take an order the shelf cannot cover.

A commitment is not a thing a dressmaker has. It is what the supply-chain trade
calls an order you have taken and cannot yet fill.

## Why it matters

The catalog entry for this screen already argues the case, in its own comment,
about the screen's NAME:

> "Backorder" is a supply-chain word, and what the screen holds is a list of
> customers waiting. The URL and the API keep `backorders`, which IS the
> industry term and is what an integrator should not have to relearn.

So the name was chosen with care: **Waiting for stock** for the list, **Owed**
for one row. Then the body of both screens went on calling it a commitment,
thirteen sentences of it, including the one that has to explain the whole
feature to somebody who has never seen it.

It is the same shape as [723](723-the-other-half-of-the-rename.md), one layer
down: that one was a pane using the wrong name for a SCREEN, this one is a pane
using the wrong name for the THING on it, and no check reads for that because
"commitment" is ordinary English rather than a banned term.
[[feedback_non_technical_audience]]

## What was done

Thirteen sentences rewritten across three panes. The replacement is the word the
screens are already named for:

| was                                                 | now                                                    |
| --------------------------------------------------- | ------------------------------------------------------ |
| A commitment appears here the moment…               | Somebody appears here the moment…                      |
| Every commitment has a date                         | Everyone waiting has a date                            |
| Ask every open commitment for its best arrival date | Ask again for the best arrival date on everything owed |
| 2 commitments still have no date                    | 2 items owed still have no date                        |
| Drop this commitment?                               | Drop what is owed?                                     |
| Existing commitments are unaffected                 | What is already owed is unaffected                     |

The notes in the files moved with the copy, so the file reads as one voice
rather than explaining the old word to the next person.

**sparx is untouched.** It names things by category on purpose, and "commitment"
is the right register there. That difference is what the brand split is for.

## Files

- `piggles/apps/workbench/surfaces/inventory/backorders.tsx`
- `piggles/apps/workbench/surfaces/inventory/backorder-detail.tsx`
- `piggles/apps/workbench/surfaces/inventory/preorders.tsx`

## Proof

Grepping the Piggles console's copy for "commitment" now returns nothing outside
the data layer's own function names. On screen, Waiting for stock reads
"Nothing has ever had to wait for stock. Somebody appears here the moment you
take an order the shelf cannot cover." 999 tests pass, typecheck and ESLint
clean.
