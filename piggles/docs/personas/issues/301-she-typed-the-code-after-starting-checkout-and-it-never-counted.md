# 301 — She typed the code after starting checkout, and it never counted

**Status:** fixed
**Severity:** major (a shopper who goes back for the code she forgot pays full
price, and the checkout shows her the saving on one step and not on the next)
**Found by:** P03 · Juniper Row · while proving [300]
**Surface:** the tenant site — **Checkout**
**Filed:** 2026-08-28
**Fixed:** 2026-08-28
**Confirmed by:** The same session, before and after, on the same basket

## What happened

Setting up a test for [300] I started checkout, went back to the basket to apply
SPRING15, and returned. The basket had **−$41.40** on it and said so. The checkout
did not:

| Step       | What it showed                                                 |
| ---------- | -------------------------------------------------------------- |
| Delivery   | Subtotal $276.00 · **Discount −$41.40** · Total so far $234.60 |
| Payment    | Subtotal $276.00 · Shipping Free · **Total $276.00**           |
| The button | **Place order — $276.00 to pay**                               |

No discount row at all on the last step. The basket in the database was right the
whole time — `discount_total_cents 4140`, the `commerce_cart_discounts` row intact,
the sale live. It was the checkout that was wrong.

## What should have happened

The saving is on the basket, so it is on the order. A shopper who remembers a code
at the last moment, goes back for it and returns is the ordinary case, not a
strange one.

## How to reproduce

Before the fix, every time:

1. Put something in a basket and press **Proceed to checkout**.
2. Go back to the basket and apply a code.
3. Return to the checkout and go through to the payment step.
4. The saving is not in the total, and the button charges full price.

## Why it matters

The shopper is charged more than her basket says, which is the same broken promise
as [298] arriving from the other end — and this one needs no defect in the code
math at all, just a shopper doing something completely normal.

For Devi it is worse than a lost sale: the customer believes she used the code, and
Devi has no way to see that she meant to.

## Where it lives

[checkout-service.ts](../../../../wizeworks/packages/commerce/src/services/checkout-service.ts).

`start()` copies the basket's money onto the session:

    subtotalCents: cart.subtotalCents,
    discountTotalCents: cart.discountTotalCents,

and **that is the only place `discountTotalCents` was ever written.** Nothing
refreshed it, and `complete()` priced the order from `session.discountTotalCents`,
so the snapshot taken when checkout began was the number the order was written
with, however long ago that was and whatever had happened to the basket since.

The delivery step appearing to know about the saving and the payment step not
knowing is the same fact seen twice: one of those panels was drawing from the
basket and the other from the frozen session.

## The fix

**An in-flight session is brought back in line with its basket whenever it is
read.** `syncSessionToCart` settles the basket, compares, and updates the session's
subtotal, discount and total when they have drifted. Every checkout step already
reads the session through `get()`, so every step — and the button — now shows what
the basket actually says.

The precedent for computing live on read is already in that same function, for the
card surcharge: _"a completed/expired session already froze its surcharge … an
in-flight session computes it live … so the storefront can disclose the fee BEFORE
the customer pays."_ Money that can still move is not a record yet. **A completed
or expired session keeps what it froze** — at that point it IS a record.

**And the order is priced from the settled basket** rather than from the snapshot,
so nothing can slip between the last read and the press. The per-line
apportionment added in [298] reads its rows fresh for the same reason: settling the
basket can delete a saving, and a stale copy would put cents on lines the order
header no longer carries.

Between them these also give [300] its backstop, which is why the two issues share
a fix.

## Confirmed by

The same session that had been showing `$276.00` against a basket holding −$41.40:
re-read as **Subtotal $276.00 · Discount −$41.40 · Total so far $234.60**, and
carried through delivery and payment to a button reading **"Place order — $234.60
to pay"** with Shipping **Free**.

The steps agree with each other and with the basket, which they did not before.

## Not checked

- **Tax.** The session freezes `taxTotalCents` the same way, and it is computed at
  its own step rather than copied from the basket, so it is a different shape and
  was not driven. Juniper Row charges no tax, so this run could not have seen it
  either way — recorded rather than assumed (CLAUDE.md RULE #4).
- **A basket whose ITEMS change mid-checkout.** The sync compares subtotal as well
  as discount, so a changed line count moves the total too, but the case driven
  here only ever changed the saving.
