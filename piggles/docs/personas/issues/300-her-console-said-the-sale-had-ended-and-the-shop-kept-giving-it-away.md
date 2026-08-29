# 300 — Her console said the sale had ended, and the shop kept giving it away

**Status:** fixed
**Severity:** major (an expired code stays honored on a basket for as long as
that basket exists — through the cart, through every checkout step, and onto the
order — and the owner's own screen says the sale is over)
**Found by:** P03 · Juniper Row · standing check "Time and dates"
**Surface:** the tenant site — **Cart → Checkout**, against **Sell › Discounts**
**Filed:** 2026-08-28
**Fixed:** 2026-08-28
**Confirmed by:** The same basket, an hour past the end, before and after
**Timezone:** machine is UTC−7 (PDT); all times below are Devi's own

## What happened

The named check is the 14-day expiry boundary — the last hour a code works and
the first hour it does not. Devi's SPRING15 was given an end, and both halves were
driven as her and as a shopper.

**The last hour is right.** With the sale ending at **00:04**, Marguerite applied
SPRING15 at **23:21:38** to a $138.00 basket and got −$20.70. Correct.

**The first hour after is not.** The sale was moved to end at **22:21**. At
**23:22**, an hour and a minute past the end:

- Her cart still showed `SPRING15` and **−$20.70**, after a full reload
- Every checkout step showed **$117.30**
- The button read **"Place order — $126.30 to pay"**
- It placed. **O-000011**, written at **23:23:05**, `discount_total 20.70`
- SPRING15's `usage_count` went to **4**

Meanwhile **Devi's own Discounts list showed the sale as "Ended"** — that badge is
derived from the window and it was right. So the console said the sale was over
while the shop was still selling at the sale price and recording another use of it.

## What should have happened

The window is part of the offer, and a basket is not a contract. When the sale
ends, the saving comes off the basket and the shopper is told, before she is
looking at a total she cannot have.

The dates were being checked **only at the moment the code was typed.** After that
the saving was frozen onto the cart as a number, and nothing looked at it again —
not a cart reload, not any checkout step, not the write.

## How to reproduce

Before the fix, every time:

1. Apply a live code to a basket.
2. In the console, end that discount (or wait for its end to pass).
3. Reload the cart. The code and the saving are still there.
4. Check out. The order is written at the sale price.

**This does not need anyone to edit a date.** A basket persists. A shopper who
applies a code on the last day of a sale and comes back a week later is checked
out at the old price, and the shop finds out from its margin.

## Why it matters

Devi runs two drops a year plus a permanent range, and 340 orders a year on thin
margins. A code that keeps working after she has ended it is money out of that
margin with no record of why — the order looks like an ordinary discounted sale.

**It is also worse today than it was yesterday, and that is worth saying plainly.**
Before [298] the cart's saving never reached the order at all, so an expired code
leaking through checkout cost nothing — it was invisible because the discount was
being dropped anyway. Fixing [298] made the cart's number the one that gets
written, which turned this from latent into live. The same run found it; it should
not have to be found twice.

## Where it lives

[cart-service.ts](../../../../wizeworks/packages/commerce/src/services/cart-service.ts)
— `recomputeCartTotals` is the single place a cart's money is re-derived, and it
summed `cartDiscount.appliedCents` without ever looking at the discount those cents
came from:

    const discounts = await tx.cartDiscount.findMany({
      where: { cartId },
      select: { appliedCents: true },
    });

Its own docblock states the invariant it was half of: _"a discount that is stored
but never folded into `discountTotalCents` is one the shopper is told they have
and is then charged in full for."_ **The opposite case — folded in but no longer
real — had no owner.**

The date window itself is checked in
[discount-service.ts](../../../../wizeworks/packages/commerce/src/services/discount-service.ts)'s
`redeemCode`, which runs once, when the code is typed.

## The fix

Three places, because the money passes through three hands and each of them was
trusting the one before.

**A lapsed saving is dropped where the cart's money is re-derived.**
`recomputeCartTotals` now reads each applied discount together with the offer
behind it and deletes any that has stopped running — outside its dates, switched
off, or retired. Deleted rather than zeroed, so the code chip and the saving go
together; a chip still sitting there worth nothing is its own confusion. Because
that function is the one place every basket mutation already goes through, this
covers all of them at once.

**And when the basket is merely LOOKED at.** A read did not recompute, so a
lapsed code stayed on screen until the shopper happened to touch something. Cart
reads now settle first — stale derived state corrected on read, the same shape as
the site frame being healed when it loads ([296]). The offer's dates ride along
with the code on the query the read already makes, so nothing costs an extra trip.

**The boundary itself now exists once.** `discountWindowState` holds the
comparison, and both `redeemCode` (when the code is typed) and the cart (every
time its money is re-derived) ask it. Two copies of that comparison is how the
two answers drift apart.

**And the order is priced from the basket, not from a snapshot.** This is what
[301] turned out to be, found while proving this one, and the two share the fix:
checkout re-derives the basket at the binding moment and prices from it, the same
reasoning the file already applied to made-to-order limits one block above — _"a
basket can sit open past midnight … this is the call that actually commits."_

**Nothing is ever written for a figure she was not shown.** The last gap was not
on the server at all: after the sale ended, the server was right and the BUTTON in
front of her still said the old total. `completeCheckout` now sends the total the
button was displaying, and the order is refused if it no longer holds. The server
cannot tell a stale page from a fresh one unless the page says what it was
showing.

**Two refusals were re-worded** while here. `Discount "SPRING15" has expired` and
`… is not yet active` were the shop's words for it, sitting beside `refusalReason`'s
"This code needs a basket of at least $100.00. Add $4.00 more to use it." They now
read "This sale has ended, so this code no longer works." and "This code has not
started yet. Try it again once the sale opens."

## Confirmed by

Driven end to end as a shopper on Juniper Row, with Devi moving the sale's end
date in the console between steps. Machine local time throughout.

**The last hour still works** — the half that must not regress. Sale ending 00:04;
SPRING15 applied at **23:21:38** to a $138.00 basket: **−$20.70**.

**A basket stops carrying a sale that has ended.** With −$41.40 applied to a
$276.00 basket and the sale then ended, reloading the cart showed **$276.00** with
no chip and no saving, and the `commerce_cart_discounts` row for that cart was
**gone** (0 rows). Checkout showed $276.00 too. Before the fix the same reload
still read −$41.40.

**A code typed AFTER checkout began now counts.** The stale session that had been
showing `$276.00` while the basket held −$41.40 re-read as **Discount −$41.40,
Total $234.60**, and the button became **"Place order — $234.60 to pay"** (see
[301]).

**The button is never overtaken.** Sitting on the review step at **"Place order —
$126.30 to pay"**, Devi ended the sale, and pressing the button answered:

> The total changed while you were checking out. Open your basket to see what it
> comes to now.

**No order was written** — the orders table ends at O-000012 — and the basket she
was sent to reads **$138.00** with the code gone. Before the fix this same
sequence wrote **O-000011 at $126.30 at 23:23:05, against a sale that ended at
22:21:00**, and took the code's usage count to 4.

**A fresh apply after the end is still refused**, in the shop's new words: _"This
sale has ended, so this code no longer works."_

**Devi's sale was put back** the way she had it: ends 09/30/2026 11:59 PM, one use
per customer.

## Not checked

- **A code that has not started yet.** `start_at` is read by the same window check
  and is dropped by the same code path, but SPRING15 has no start date set, so the
  not-yet-begun half was not driven on a screen.
- **`total_usage_limit` being reached while a basket is open.** The same shape —
  validated when typed, never again — and the fix drops a discount only for the
  window and the active flag, not for a cap somebody else has since consumed.
  Recorded rather than assumed either way.
