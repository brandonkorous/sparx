# 038 — Her customer was told to go to a settings screen they cannot reach

**Status:** fixed — both halves: what the customer reads, and that the owner is told at all
**Severity:** blocker (a live shop that takes baskets and cannot take money)
**Found by:** P01 · Thistle & Rye · act 8 — paying for two loaves and a box of buns
**Surface:** the tenant's live `/checkout`, step 3
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · act 8, on both screens

## What happened

Cart correct at $33.00, contact done, **Collect in person — Free** chosen. Press
_Continue to payment_ and a red box says:

> Online payments are not configured for this site. Set up a payment gateway in
> Settings → Payments.

## Why it matters

**That is the owner's sentence, thrown from a public endpoint, so the only person
who ever reads it is a customer.** A stranger who chose two loaves, typed their
address and clicked through three steps is told to go to a settings screen they
have never heard of, cannot reach, and have no business being in. There is
nothing they can do with it.

It also names OUR navigation to somebody who is not in our product. "Settings →
Payments" is workbench furniture; on a bakery's shop it is somebody else's
software showing through the wall.

And the other half: **Marisol had no idea.** Her shop was live, listing nine
products, filling baskets, and unable to take a penny. Her console said nothing.

This is on record as a PASS. `docs/testing/e2e/checklist.md:124` ticks it off:
_"reaching the Payment step at storefront checkout correctly shows … checkout
cleanly blocked, no broken/stuck state."_ Clean from the code's side. Read it as
the customer and it is a dead end with an instruction for somebody else in it.

## The fix

**What the customer reads** — `NO_PAYMENTS_MESSAGE` in `checkout-service.ts`,
shared by both throw sites:

> This shop cannot take card payments online just yet, so the order cannot be
> finished here. Nothing has been charged. Get in touch with the shop to arrange
> it — their details are on this site.

True, says no money moved, names no admin screen, and points at the one thing
that can still get them their bread — the shop, whose phone number and address
are already on the page under the message.

**What the owner is told** — a warning on Sell › Products, the sibling of the one
[#036](036-her-shop-told-every-visitor-there-was-nothing-to-buy.md) put there:

> **Nobody can pay you on your site yet** — Customers can fill a basket and reach
> the last step, and then there is no way for them to hand over the money — so
> the order is lost right at the end. → **Set this up**

Keyed on `PaymentConfig.isActive`, which is the active gateway's collecting
state. `null` while unknown, so a failed request never accuses a business of
something that may not be true. It does not fire for a tenant who deliberately
chose **Manual payments** — that is a decision, not an accident.

## What is still open — Brandon's call, not a patch

The "Get set up" checklist DOES carry _"Connect payments — Connect Stripe to
accept orders and payouts"_, as step 6 of 6. But the page framing above it reads
_"the few things worth doing next — do them in any order, or come back whenever
you're ready."_ Once a shop is genuinely live with products on sale, that step
stops being optional and the framing understates it. Whether the checklist should
change tone when the shop goes live is a design decision.

Separately: her own `/order` page says **pay at the counter**, and a
collection-only bakery may reasonably want an order it can take without a card
processor at all. There is a **Manual payments** gateway in the picker ("No fee.
No online card processing") — whether that should complete a checkout rather than
block it is a product decision, not a bug.
