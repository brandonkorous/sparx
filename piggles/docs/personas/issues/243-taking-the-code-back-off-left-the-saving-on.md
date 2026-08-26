# 243 — Taking the code back off left the saving on

**Status:** fixed and confirmed
**Severity:** high
**Found by:** P03 · Juniper Row · act 9 — removing SPRING15 from a basket
**Surface:** the shop's basket
**Filed:** 2026-08-26
**Fixed:** 2026-08-26
**Confirmed by:** P03 · Juniper Row · act 9 — removing the code returns the basket to $126.00

## What happened

A basket of three t-shirts, $126.00, with SPRING15 applied and $18.90 off. The
shopper pressed the small × beside the code.

The chip vanished. The saving did not:

```
Subtotal (3 items)   $126.00
Discount             −$18.90     ← the code is gone; this is not
Estimated total      $107.10
```

Still there after a full page reload. In the record: zero `cart_discounts` rows,
`discount_total_cents` still **1890**.

## What should have happened

Removing the code puts the money back.

## Why it matters

It is the exact opposite of [242] and it costs the same person's till. A shopper
who tries a code, changes their mind and removes it keeps the discount all the
way through checkout — and the basket no longer shows a code to explain why.
Nothing looks wrong; the number is simply too low, for ever.

## Where it lives

[cart.ts](../../../../wizeworks/services/api-rest/src/routes/v1/public/cart.ts),
and the comment is the bug:

```ts
// No service method removes a cart discount; the join row is safe to drop
// directly under RLS. Recompute happens lazily on the next cart read.
```

**Nothing recomputes on a cart read.** `serializePublicCart` returns the STORED
`discountTotalCents`. The sentence is an assumption written as a fact, and it sat
directly above the code it was wrong about. The market checkout carried the same
comment and the same bug.

## The fix

A real `discountService.removeCode(ctx, { cartId, code })` that deletes the row
and recomputes the totals — the mirror of what [242] added on the way in. Both
public routes call it now. It returns how many codes came off, so a caller can
tell "removed" from "was never on there".

## Related

[242](242-the-saving-was-recorded-and-never-taken-off-the-bill.md) is the same
missing recompute on the way in.

## Rating effect

`Sell › Discounts` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
