# 548 — A gift card spent on an order that says nobody paid

**Status:** fixed; one stranded row left as evidence
**Severity:** high
**Found by:** Devi, checking what her two gift cards were worth
**Surface:** `wizeworks/packages/commerce/src/services/discount-service.ts`
**Filed:** 2026-09-16
**Family:** [[feedback_a_fix_leaves_its_neighbour_behind]] · [[feedback_screen_over_a_function_nobody_calls]]

## What she saw

Sell → Gift cards. Two cards, both **Used up**, both **$0.00**.

| code                | for            | balance | state   |
| ------------------- | -------------- | ------- | ------- |
| 969G-HVUS-BCAT-7PW2 | Jo Kim         | $0.00   | Used up |
| QM44-2DTN-6HM4-6RA9 | Nadia Ashcombe | $0.00   | Used up |

The $150 card was spent on order **O-000015**. That order reads:

> **$659.00 still owed**
> _"No money has come in for this order yet."_
>
> **Money in** — _"No payment has been recorded against this order yet."_
>
> **Asking for payment** — INV-000003, $659.00 asked for, sent Sep 7 to
> marguerite.adeyemi@example.com, **$659.00 still owed**

Marguerite has already handed over $150 of it. Two screens, one event, opposite
answers, and the customer is asked for money she has already paid.

## Measured

```sql
select count(*) as redemptions_against_an_order,
       count(*) filter (where p.id is null) as with_no_payment_recorded,
       sum(-g.delta_cents) filter (where p.id is null)/100.0 as money_stranded
from commerce_gift_card_transactions g
left join order_payments p
  on p.order_id = g.order_id and p.processor = 'gift_card' and p.tenant_id = g.tenant_id
where g.order_id is not null and g.delta_cents < 0;
```

| redemptions against an order | with no payment recorded | money stranded |
| ---------------------------- | ------------------------ | -------------- |
| 2 (both hers)                | **1**                    | **$150.00**    |

The same action, twice, with two different results:

| order    | gift card used | payment row | order says   |
| -------- | -------------- | ----------- | ------------ |
| O-000016 | $40.00         | yes         | Part paid    |
| O-000015 | $150.00        | **none**    | **Not paid** |

## The cause

`redeemGiftCard` takes an `orderId`, debits the card, writes the ledger row and
publishes `giftcard.redeemed`. It does NOT record the money. That was the
caller's job:

```ts
await discountService.redeemGiftCard({ ...ctx, tx }, { … });
// …and the order has to KNOW it was part-paid, or the shopper pays twice.
await orderPaymentsService.recordPayment({ ...ctx, tx }, { processor: 'gift_card', … });
```

The comment is right and even quotes these figures. It was added on 2026-09-08;
the $150 came off the card on 2026-09-05. So this was already found once, and
the fix went to **the one caller** rather than to the function that carries the
obligation. `redeemGiftCard` still took an `orderId` and still left the second
half outside itself, so the next caller starts with the same hole.

## The fix

The payment write moves INTO `redeemGiftCard`, in the same transaction as the
debit, and out of checkout. The card has the code, the currency and the amount;
the argument has the order. Everything the payment needs was already in hand.

There is now no version of "the card was spent on this order" that is not also
"this money came in for this order", because it is one act.

Same transaction is not a nicety either: a card debited against an order that
records nothing is money the shopper can neither spend nor get back, so the two
have to fail together.

## Proven

5 guards in `redeem-gift-card.test.ts`, proven red by taking the payment write
back out (2 of 5 fail). 211 commerce tests pass.

## Left alone

O-000015 still reads $659.00 owed. Repairing it means asserting that $150 was
paid on a card whose ledger already says so, and the console's own
record-a-payment form offers only cash, check and wire transfer — there is no
way for her to record a gift card by hand, and there should not be, because that
would let somebody credit an order without debiting a card. The row stays as
evidence of what the missing write cost.
