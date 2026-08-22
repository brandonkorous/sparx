# 054 — The first count of zero never reached her website

**Status:** fixed
**Severity:** **high** (the most common first count a shop ever records was a no-op to the storefront)
**Found by:** P01 · Thistle & Rye · act 11 — counting the seeded rye at zero
**Surface:** `@wizeworks/inventory` › the movement ledger
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · act 11 — **Morning bun**, counted at zero, went sold out everywhere

## What happened

She counted the seeded rye. There were none left, so she typed **0** and saved.

The console agreed immediately, and in strong terms: **0 to sell · 0 on the shelf
· Nothing left to sell**. The database agreed: a level row at Main Warehouse,
`on_hand = 0`. The product's own `in_stock` column still said **true**, and her
shop grid went on listing the rye with no marker on it.

## Why it matters

"We are out of this" is the FIRST count most shops ever record. It is not an
edge: a bakery's opening balance for today's rye at four in the afternoon is
zero. A business that reaches for stock tracking usually reaches for it at the
moment something ran out.

The console and the website disagreed, the console was right, and the disagreement
was invisible from either screen.

## Why it happened

`applyMovement` returns early when a movement has no effect:

```ts
// A zero-effect movement (e.g. a sync run that found no change) writes no
// ledger row — keeps `onHand == Σ(movements)` clean and avoids feed noise.
if (delta === 0 && allocatedDelta === 0) {
  return noChange('', current);
}
```

That is right about the LEDGER. Nothing moved, so no movement row: correct, and
the invariant it protects is a good one.

It is wrong about the FLAG, and only in one case. Step 1 of the same function
creates the level row if it is missing (`INSERT … ON CONFLICT DO NOTHING`, so a
concurrent burst of first movements cannot collide). Setting on-hand to 0 on a
row that was just created at 0 gives `delta === 0` — so the row went from
**absent** to **present-at-zero**, and the early return skipped step 7,
`syncProductInStock`.

Absent and present-at-zero are not the same thing. `availability.ts` is emphatic
about it in its own header: a variant with no level row has never been counted,
which is the absence of a measurement rather than a measurement of nothing, so it
takes the untracked path and is always sellable. Creating the row is what makes
it stock-managed. Nothing moved and yet the answer changed.

## The fix

The level-creating `INSERT` now reports whether it inserted — `DO NOTHING`
returns 0 when the row was already there, 1 when this call brought it into
existence — and the zero-delta return syncs the flag when it did:

```ts
if (delta === 0 && allocatedDelta === 0) {
  if (createdLevel) await syncProductInStock(tx, input.variantId);
  return noChange('', current);
}
```

Narrow on purpose. A genuine no-op on an existing row still writes nothing and
touches nothing, which is what the early return is for.

**And a migration for the rows already written**, because a code fix alone leaves
them wrong until something else happens to move that stock:
`20270402000000_counted_at_zero_products_are_sold_out` — the exact mirror of
`20270401000000_uncounted_products_are_sellable`, on the same column.

It is one-directional (`true` → `false` only, the only value this bug can leave
behind) and every clause is a term of `syncProductInStock`'s own predicate: the
product has been counted somewhere, everything counted nets to zero or less, no
live variant is orderable without stock, and the tenant actually tracks stock —
`inventory`, or `commerce`/`b2b`, which bundle it free. Idempotent: the
`in_stock = true` guard means a corrected row is no longer a candidate.

Dry-run on the dev database as a `SELECT`: **one row, Seeded rye.** Nothing else
in a ten-product catalogue matched, which is the point — an uncounted product is
the 20270401 case and must stay sellable.

## Confirmed

**Morning bun**, counted at zero AFTER the fix, with nothing else done to it:

|                              |                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `commerce_products.in_stock` | `true` → **`false`**, with no ledger row written                                   |
| Her shop grid                | **Sold out** over the card                                                         |
| Her product page             | the sold-out notice ([053](053-sold-out-was-a-thing-her-website-could-not-say.md)) |

**Seeded rye**, counted at zero BEFORE the fix, still reads `in_stock = true` —
the stale row the migration exists to correct, sitting there as its own evidence.
Its product page is right regardless, because [053](053-sold-out-was-a-thing-her-website-could-not-say.md)
made the buy box read the variant's live availability rather than the column.
