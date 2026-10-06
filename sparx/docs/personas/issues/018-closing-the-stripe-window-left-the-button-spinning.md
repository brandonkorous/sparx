# 018 — Closing the Stripe window left the button spinning

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 1
**Surface:** workbench › first-run setup › "Get paid" (both flows)
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 1 — "Start again" under the button returned it to "Connect Stripe"
**Blocked on:** —

## What happened

Doty pressed **Connect Stripe**. Stripe's sign-up opens in a separate window. If
that window is closed without finishing, the button spins for good: nothing on
the page says what it waits for, and only a reload brings the button back.

## What should have happened

While Stripe is open, the page says to finish there and offers a way back.

## Why it matters

Closing the Stripe window is the commonest thing an owner does when Stripe asks
for a bank account he does not have to hand. The page then looks broken.

## Where it lives

`lib/onboarding/use-stripe-connect.ts` (both consoles): `connecting` was cleared
only by the Stripe window's message back.

## The fix

- The hook returns `cancel()`: closes the Stripe window and clears the wait.
- New `surfaces/onboarding/stripe-waiting.tsx` (both consoles), shown under the
  button while waiting: "Finish connecting in the Stripe window. Closed it by
  mistake? Start again". Used by the wizard's payments step and the story's "get
  paid" chapter.
- Not by watching `popup.closed`: once Stripe's page isolates itself from its
  opener that reads closed while the window is still open.

## Confirmed by

> Re-ran P01 act 1. Pressed Connect Stripe: the note appeared under the card.
> Pressed "Start again": the button read "Connect Stripe" again, ready.

Stripe's own onboarding was not completed: it is an account on Stripe's site
(outside service, see the run log).

Checks: sparx and Piggles workbench `tsc --noEmit` exit 0; eslint 0; prettier clean.

## Rating effect

—
