# 646 — The guard watching for another company's name was counting words nobody reads

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 222 (the pre-push guard went red on work that changed no words)
**Surface:** `scripts/check-boundaries.mjs`, the ratchet on sparx's name inside Piggles
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** the count fell from 59 to 11, and the guard proved red twice

## What happened

The pre-push guard failed:

```
✖ another brand's name in Piggles' own words — 59, baseline 49
```

Nobody had written the word. What had happened is that an earlier pass moved
sentences out of JSX text and into `productCopy('key', 'text')` calls. The guard
reads **string literals**, and JSX text is not one — so those sentences had been
invisible to it for as long as they had existed, and the move made eleven of them
visible at once.

So the number rose because the guard's eyes opened, not because the product
regressed. A ratchet whose number moves for that reason is a ratchet nobody can
read. [[feedback_structural_checks_go_blind]]

## The worse half

Of the 59, **not one on a screen a Piggles customer can open was a real leak.**

`productCopy('inventory.setup.title', 'Getting your stock into sparx')` is two
things: an id, and the text to use **when the brand has not written its own.**
The file holding Piggles' own sentences says so out loud:

> a key with no entry falls back to the surface's own sparx text, which is true
> but off-voice … an unfilled key is a Piggles customer reading sparx's words, so
> it is a **debt, not a resting state**.

Every one of the eighteen keys on a visible screen **already had a Piggles
sentence written**. "Getting your stock into sparx" is dead text: nothing renders
it, and no customer can reach it. The guard was reporting a shop reading another
company's name when no shop was.

That is the same failure the guard itself was written for, one level up: a check
that says it is watching something and is watching something else.

## The fix

The guard now reads the brand's own writing first — the keys in `copy.ts` and
`vocabulary.ts` — and skips a `productCopy` fallback whose key has an entry,
because nothing renders it.

A fallback with **no** entry still counts, because that one really is on screen.
That is the debt the copy file names, and it is what the number should have meant
all along.

The guard also refuses to run blind: if `copy.ts` moves, it exits 1 naming the
file rather than quietly counting sentences that are already written.

## What the number means now

**59 → 11**, and the baseline is set to 11. Every one of the eleven is a sparx
PRODUCT on a surface Piggles does not have:

| what                     | where it is kept out                              |
| ------------------------ | ------------------------------------------------- |
| "What you pay sparx"     | `finance.subscription` is a hidden surface        |
| sparx.market ×2          | `commerce.market` is a hidden surface             |
| sparx Pay ×4             | `commerce.payments.sparx_pay` is a hidden feature |
| the sparx marketplace ×4 | `commerce.channels.market` is a hidden feature    |

piggles/CLAUDE.md is explicit that those are **excluded rather than renamed** —
"Piggles Pay" is a product nobody can sign up for, which is worse than the leak.
So eleven is the honest resting state, and the ratchet is now 38 tighter than it
was.

## Guard

Proved red twice, before believing it:

1. **Remove one Piggles sentence** (`inventory.setup.title` from `copy.ts`):

   ```
   ✖ another brand's name in Piggles' own words — 12, baseline 11:
      …/inventory/setup-wizard.tsx:230: Getting your stock into sparx
   ```

   The fallback it falls back to is named, in the file it is in. That is the
   real debt, and it is now the only thing the number counts.

2. **Move `copy.ts` away**: the check exits 1 naming the missing file rather
   than scanning less than it claims.

Restored byte-identical after each, and the check reads `✓ sparx sentences under
piggles/: 11` again.

## Still not seen

The guard reads string literals, so **prose written as JSX text is still
invisible to it**. A rough scan of `piggles/apps` finds around 80 more mentions
outside string literals; most are identifiers and comments rather than sentences,
but nothing has separated them. That is the next piece of this, and it is the
reason the count jumped in the first place.
