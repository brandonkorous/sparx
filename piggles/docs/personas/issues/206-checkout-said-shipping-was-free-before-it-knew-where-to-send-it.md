# 206 — Checkout said shipping was free before it knew where to send it

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 5
**Surface:** the tenant's website — Checkout, all three steps
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 5, as a shopper, both sides of the threshold

## What happened

With Devi's delivery rule live — **$9 flat, free over $150** — a shopper put a
$128 overshirt in the basket and went to checkout. The order summary, on screen
from the first step:

```
Subtotal   $128.00
Shipping   Free
Total      $128.00
```

Nobody had entered an address. Nothing had been quoted. "Free" was not an answer,
it was a zero.

It is still there at step 2, and there it becomes a **contradiction on one
screen**: the delivery choice she had just picked said `$9.00` while the summary
two inches to the right said `Free` and `Total $128.00`.

Only at step 3 does it correct itself:

```
Subtotal   $128.00
Shipping   $9.00
Total      $137.00        Place order — $137.00 to pay
```

A second thing came out of the same summary. Changing the quantity in the basket
and returning to checkout gave:

```
Marlow Knit · M · Oat    $192.00      ← the line, correct
Subtotal                  $96.00      ← the subtotal, one quantity behind
Total so far              $96.00
```

Three numbers about the same basket, on the same card, and two of them wrong.

## What should have happened

A cost that has not been worked out is not zero, and a total that excludes it is
not the total.

## Why it matters

This is money, on the last screen before someone pays, and it is wrong in the
direction that makes people angry: **the number goes UP** between the summary
they read and the button they press. A shopper who decided at $128 finds $137.

It is the platform-wide rule again — _never present absence as measurement_ — in
the place where it costs the most. The same run has already found it as
"[203] her shop page said she had nothing to sell" and "[175] the counts list
reported Difference $0.00 for a count with no costs." Zero is the most dangerous
default there is, because it renders as a real answer.

And Devi's whole free-shipping rule is the thing being misrepresented. She set
$150 as the line worth crossing. A checkout that says "Free" on a $128 order has
told a shopper they already crossed it.

## Where it lives

[order-summary.tsx](../../../../wizeworks/apps/site/components/checkout/order-summary.tsx):

```tsx
{
  totals.shippingTotalCents > 0 ? formatMoney(totals.shippingTotalCents, currency) : 'Free';
}
```

Zero has two meanings and this renders both as one.

The second half is in
[checkout-flow.tsx](../../../../wizeworks/apps/site/components/checkout/checkout-flow.tsx).
The summary reads `session?.totals ?? cart.totals`, preferring the session — and
the session is **opened on mount**, before an address, before a rate, and it does
not follow a basket edit:

```ts
// Open the session as soon as there is a cart, so the fulfilment question
// below can be asked before the first form is drawn.
useEffect(() => { if (!cart.cartId || session || opening.current) return; … });
```

So its totals are both premature and stale, and it wins over the cart's live ones
for the whole of steps 1 and 2.

**The first attempt at this fix was wrong and is worth recording.** I keyed
"shipping is known" on `Boolean(session)`, reasoning that the session carries the
rate. It does — eventually — but it exists from the first render, so the flag was
true on step 1 and the screen did not change. Reading the code that creates it is
what corrected me; the screen had already said so.

## The fix

One honest boundary, used twice: **the session becomes the authority on money
when the delivery step has been submitted**, and not before.

```ts
const settled = collectionOnly || step === 'payment' || step === 'done';
```

- Before that, the summary reads the **live cart** totals, so it tracks a basket
  edit instead of going stale.
- The shipping row reads **"Once we know where"** rather than a price.
- The total is labelled **"Total so far"**, because it is one.

A collection-only shop short-circuits to settled: there is nothing to work out, so
free is a real answer from the first screen.

## What it looked like once fixed

Step 1, two Marlow Knits, no address given:

```
Marlow Knit · M · Oat   $192.00
Subtotal                $192.00
Shipping     Once we know where
Total so far            $192.00
```

The line, the subtotal and the total agree, and nothing claims to know the
postage.

Both sides of Devi's threshold then behave, from the delivery step:

| Basket  | What checkout offered         |
| ------- | ----------------------------- |
| $128.00 | Delivery · 4 days — **$9.00** |
| $192.00 | Delivery · 4 days — **Free**  |

and at payment the $128 basket reads Shipping $9.00, Total $137.00, on a button
that says **Place order — $137.00 to pay**.

## Rating effect

None — checkout is on the storefront, which [rating.md](../rating.md) does not rate.
Recorded in the run log of [03-juniper-row.md](../03-juniper-row.md).
