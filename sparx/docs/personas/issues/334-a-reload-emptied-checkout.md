# 334 — A reload emptied checkout

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 9, a stranger's checkout
**Surface:** Gillett site › /checkout; every selling site; `wizeworks/apps/site`
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** sparx as a stranger (Gillett Diesel Service), 2026-10-18
**Blocked on:** —

## What happened

A stranger filled in her name and email, then her delivery address, and the page reloaded. Checkout opened on step one with every field empty, as if she had never been there.

The server had kept it all. Opening checkout on the same basket hands back the same session (`checkoutService.start` is idempotent), with the name, email, phone and delivery address on it. The page only read the session's totals.

## What should have happened

A reload puts back what she typed.

## How to reproduce

1. Put something in the cart and open checkout.
2. Fill in the contact step, then the delivery step, and continue to payment.
3. Reload the page.

## Why it matters

A phone that drops a tab, a misclick on Back, a slow card form refreshed: each one made a buyer type everything again, and some of them leave instead.

## Where it lives

`wizeworks/apps/site/lib/checkout-resume.ts` (new: `resumedContact`, `resumedAddress`), `lib/checkout-client.ts` (`CheckoutSession` now types `customerName`, `customerPhone`, `shippingAddress`), `components/checkout/checkout-flow.tsx`.

## The fix

When checkout opens its session, it fills the contact and delivery forms from what the session holds, into empty fields only, so it never overwrites something being typed or a signed-in shopper's saved details. The address keeps the form's own shape (`recipientName` becomes the name on it).

- A reload opens past the contact step when the session holds her name and email (`contactDone`). A signed-in shopper's session opens with her email alone, so she still sees the contact step she has not filled in.
- An address typed but not yet sent with "Continue to payment" is on no session, so it is kept in the tab while she types (`saveAddressDraft`, session storage, under that checkout's session) and given back when the session has none of its own. Storage that is blocked only means it is not kept.

Tests: `lib/checkout-resume.test.ts` (5: the contact back, the address back in the form's shape, no address before one was given, past a finished contact step, not past one a signed-in shopper has not seen). Site 55 files / 518; site `tsc` clean.

## Confirmed by

2026-10-18, in a headless browser on the Gillett site. After the contact and delivery steps and "Continue to payment", a reload showed "Your name: Rory Banks" and the email; Continue showed "Full name: Rory Banks, Address: 88 E Center St, City: Provo, State / Region: UT, Postal code: 84606".

Then the two limits, the same day: the contact step done and an address typed without pressing anything, a reload opened on "Where should we send it?" with "Tess Ortiz, 300 S State St, Salt Lake City, UT, 84111" back in the fields.

## Rating effect

None to the scores.
