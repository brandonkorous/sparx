---
title: Core charges on rebuilt parts
node: features
type: entry
status: active
sources:
  - wizeworks/packages/commerce-schemas/src/cores.ts
  - wizeworks/packages/commerce-schemas/src/core-choices.ts
  - wizeworks/packages/commerce/src/services/core-service.ts
  - wizeworks/packages/commerce/src/services/core-choice-service.ts
  - docs/09-ecommerce-engine-prd.md §5 Core charges
  - sparx/docs/personas/issues/051, 057
---

A rebuilt (remanufactured) part is sold with a **core charge**: a refundable deposit
paid on top of the price and given back when the old part (the "core") comes back fit
to rebuild. Part of the **commerce** module. Two ways to buy one:

- **Pay the deposit, ship now.** `ProductVariant.coreChargeCents`. The deposit rides on
  the part's OWN line at every stage (cart line, order line `coreCharge`, invoice line)
  and is never discounted, taxed, surcharged or in a subtotal, always in the total.
  Each unit's core ends one way: the part came back (a return), the old part came back
  (`coresReturned`, deposit refunded: an open invoice first, then the card or account
  credit), or the deposit was kept (`coresKept`, with a reason).
- **Send the old part first.** `coreFirstOffered` on the variant, `coreFirst` on the
  cart and order line, no deposit (a check forbids both). The line ships one unit per
  old part that arrived, unless the business chose "ship without waiting"
  (`coreHoldReleasedAt`). Refused on a dropshipped part. See [[ship-gate]].

**A core charge faked as a choice.** Stores with no deposit sell one part as two
versions ("Accept Core Charge (+$150)" / "Defer Core Charge"). `core-choice-service`
turns each into one version after the owner reviews it. The deposit is read from the
WORDS (`depositInLabel`), never the price difference: on Gillett Diesel's 84 the
difference matched almost none, and 15 had the "ship now" side cheaper. Move in brings
them in as they are, points to "Core charges set up as choices", and a re-import leaves
a converted product's choice and prices alone (or it would charge the core twice).

**Why:** without it a parts business fakes the deposit as a dearer version, which
splits one shelf's stock in two, cannot give money back, and cannot hold a part until
the old one arrives.

**How to apply:** any new money total, document or report must keep the deposit out of
subtotals and revenue (a deposit still out is the customer's money). Any new way to
ship goods must go through `createFulfillment`, which applies [[ship-gate]].

Related: [[ship-gate]], [[modules]], [[taxonomy]]
