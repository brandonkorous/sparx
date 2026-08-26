# 241 — The conditions on a sale were stored, shown back, and never read

**Status:** fixed and confirmed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 9 — building SPRING15
**Surface:** mypiggles › Sell › Discounts, and the shop's own basket
**Filed:** 2026-08-26
**Fixed:** 2026-08-26
**Confirmed by:** P03 · Juniper Row · act 9 — a $42 basket is now refused by a $100 code, and told the amount it is short

## What happened

Devi built her spring sale: 15% off, minimum spend $100, one per customer,
ending 30 September. The form took all of it and the record stored all of it:

```json
[{ "kind": "min_subtotal_cents", "value": 10000 }]
```

Then a shopper put ONE t-shirt in the basket — **$42.00** — typed SPRING15, and
the code was accepted.

## What should have happened

A basket that does not meet the conditions is refused, and told why.

## Why it matters

This is money out of her till on every order that should not have qualified.
"Minimum spend $100" is the whole reason a shop runs a percentage offer: it is
the thing that stops a 15% code being a 15% pay cut. Hers did nothing.

And it was not one condition. `redeemCode` checked the date window and the usage
limits and then applied the percentage. **`discount.conditions` was never read
by anything, anywhere in the repo.** So none of these did what the screen said:

| Condition             | Offered in the console | Enforced |
| --------------------- | ---------------------- | -------- |
| Minimum spend         | yes                    | **no**   |
| Minimum item count    | yes                    | **no**   |
| First order only      | yes                    | **no**   |
| Only certain products | no screen for it       | **no**   |
| Only certain groups   | no screen for it       | **no**   |
| Only certain people   | no screen for it       | **no**   |
| Only certain channels | no screen for it       | **no**   |

The three the console offered were the worse half: a shop owner sets them, reads
them back, and has been given a promise nothing keeps.

## Where it lives

[discount-service.ts](../../../../wizeworks/packages/commerce/src/services/discount-service.ts).
`redeemCode` carried a doc comment describing work it did not do:

> Redeem a discount code against a cart. Validates the code, **evaluates
> conditions**, enforces totalUsageLimit + perCustomerLimit …

The body validates the code, asserts the window, asserts the usage limits, then
computes the delta against `sumCartLineSubtotals` — the WHOLE cart. There is no
conditions branch to find.

Half of this is also a missing screen: `product_in` and `collection_in` have been
in the schema since the module shipped and no surface ever offered them, so
"15% off the core range" could not be written down even if the evaluator had
existed.

## The fix

A real evaluator —
[discount-conditions.ts](../../../../wizeworks/packages/commerce/src/services/discount-conditions.ts)
— that `redeemCode` calls before applying anything. Three things it does on
purpose:

**It refuses in a sentence a shopper can act on.** "Conditions not met" tells
somebody nothing:

> This code needs a basket of at least $100.00. Add $58.00 more to use it.

**It gathers only what the conditions ask for.** An unrestricted code costs one
read of the basket and nothing else; the collection lookup, the order-history
count and the segment read each happen only if a condition needs them.

**The saving comes off what the offer covers.** With a product or group
restriction the percentage applies to the qualifying lines only — otherwise
"15% off the core range" quietly discounts the dress sitting beside it.

And the missing screen: a **What it applies to** section on the discount editor,
listing the shop's groups with their sizes, defaulting to "Anything in the shop".

Eleven unit tests, including the two that matter most — that an unknown
`hasOrderedBefore` is not read as "has ordered" (that would refuse a guest who
has never bought anything), and that two restrictions are an OR.

## What it looked like once fixed

Four behaviours, all on her own shop:

```
1 tee, $42                    → "This code needs a basket of at least $100.00.
                                 Add $58.00 more to use it."
3 tees, $126 (core range)     → Discount −$18.90, total $107.10
+ Linen Shirtdress, $271      → Discount still −$18.90; the dress is full price
Linen Shirtdress alone, $145  → "This code does not apply to anything in
                                 your basket."
```

The third line is the one worth pausing on: 15% of $271 is $40.65, and the saving
stayed at $18.90 because only $126 of that basket is in the offer.

## Housekeeping done alongside

`discount-detail.tsx` was 917 lines and this touched it, so under RULE #0.5 it
split by responsibility into eight files, all under the cap: the draft and its
validation, the offer fields, what-it-applies-to, the limits, the notices, the
lifecycle pair, the writes, and the surface itself.

## Related

[242](242-the-saving-was-recorded-and-never-taken-off-the-bill.md) is what
happened to the money even when a code DID qualify.
[243](243-taking-the-code-back-off-left-the-saving-on.md) and
[244](244-she-gave-her-email-and-the-basket-stayed-anonymous.md) are the other
two the same afternoon turned up.

## Rating effect

`Sell › Discounts` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
