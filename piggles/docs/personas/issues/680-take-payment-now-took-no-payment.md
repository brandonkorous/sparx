# 680 — "Take payment now" took no payment

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 241
**Surface:** mypiggles › Stock › Preorders › (the offer dialog)
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03, on the screen — see below
**Blocked on:** —

## What happened

The bottom of the preorder form was a switch:

> **Take payment now** ( • )

It was on by default. Turning it off changed nothing about when anybody was
charged. There is no deferred capture on this platform, and the switch was the
only thing on any screen suggesting there is.

## Why

`chargeUpFront` is a real column with a real default, and it is read by nothing.
MEASURED 2026-09-18 across the whole repository:

```text
$ rg chargeUpFront --glob '!**/node_modules/**'
docs/146…                 a note about it
prisma schema             the column
inventory/preorders.ts    stored, serialized
api-rest public/commerce  put on the public product payload
apps/site/lib/commerce.ts the TYPE of that payload field
workbench preorders.tsx   the switch
```

Every hit is the value travelling. **Not one reads it.** Not the checkout, not
an email, and — despite the field being sent all the way to the storefront's
`PublicPreorderOffer` — not the product page either. `product-detail.tsx` never
mentions it. [[feedback_fetched_but_never_rendered]]

The doc is wrong in the same direction, and was:

> **`chargeUpFront` drives wording, not payment capture.** The column records
> the merchant's intent and the storefront reads it.

The storefront does not read it. [[feedback_verify_capability_in_code_not_docs]]

## What should have happened

A control that changes nothing must not be on the screen. This is not a case of
"it is not wired up yet", either, which is why relabelling it would not have
been enough:

**A card authorization cannot survive a preorder.** Deferring the charge to
fulfilment means holding an authorization, and those expire in about a week.
This dialog's own example note is "Ships with the spring run" — months. The off
position was not unbuilt, it was undeliverable in the shape the label implies.
Doing it honestly means storing a payment method and charging it at fulfilment,
which is a payments feature, not an inventory one.

So the honest answer is not a better switch. It is no switch, and one sentence
of fact in its place.

[[feedback_a_promise_in_copy_is_a_contract]]

## How to reproduce

Before the fix:

1. Sign in as `p03.devi@piggles.test`, Juniper Row.
2. **Stock › Preorders**, open an offer.
3. Turn **Take payment now** off and save. Nothing about the checkout changes,
   on the shop or anywhere else.

## Why it matters

This is the one control on the screen that is about MONEY, and a maker deciding
whether to run a preorder at all is deciding exactly this: do I get paid now, or
do I fund the cloth myself and get paid on delivery. Turning the switch off and
believing it is a business decision made on false information.

It is also the quiet kind of wrong. Nothing errors, nothing looks broken, and
the merchant finds out when a customer is charged three months before their
dress exists.

## Where it lives

| What                   | Where                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| The switch             | `piggles\|sparx/apps/workbench/surfaces/inventory/preorders.tsx` |
| The column nobody read | `wizeworks/packages/inventory/src/services/preorders.ts`         |
| The claim in the doc   | `docs/146-inventory-parity-and-gap-closure.md`                   |

## The fix

The switch is gone. In its place, what actually happens:

> A preorder is paid for at the checkout, the same as anything else in your
> shop. Say so in the words above if the wait is a long one: people mind far
> less when they were told.

The second sentence points at **What to tell people instead, or as well**, which
is the field that DOES reach the customer, so the screen still gives her a way
to handle the thing the switch pretended to handle.

The column stays, at its default of true, with the reason recorded at the call
site so nobody re-adds the control without building the capability first.

## Confirmed by

> The offer dialog now ends: **Limit how many you will owe** (switch), then the
> sentence above, then Cancel / Start taking preorders. Two preorders were opened
> through it, both without the switch, and both stored `charge_up_front = true`.

The checkout itself was not driven — Juniper Row's site is suspended for an
expired trial, so no product page renders for her. That is not a gap in the
evidence for this one, because the finding is that NOTHING reads the column: the
repository-wide search above is the measurement, and a screen could only have
confirmed what it already shows.

## Gap to 10

Charging on fulfilment is a genuinely wanted thing for a maker with a long lead
time, and it is a payments feature: a stored payment method plus a charge at
fulfilment, not an authorization held open. The column is already there for when
it is built.

The doc line was corrected in the same pass.

## Rating effect

Recorded in [rating.md](../rating.md) on the `inventory.preorders` row.
