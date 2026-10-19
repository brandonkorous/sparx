# 327 — sparx Pay said "not finished" and not what Stripe needed

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 9, the Stripe connection
**Surface:** console › Payment providers › sparx Pay (both consoles); `wizeworks/services/api-rest`
**Filed:** 2026-10-18
**Fixed:** 2026-10-18
**Confirmed by:** sparx as Ines Varga (Quiet Bench Repair), 2026-10-18
**Blocked on:** —

## What happened

Doty sent Stripe's setup form. The date of birth did not match, so Stripe asked for a photo of an ID. Back in the console, sparx Pay said "You started setting up sparx Pay but it is not finished" and nothing else. The "Details still needed" alert had gone, because the form had been sent. Stripe's own answer named the one thing it needed: `individual.verification.document`.

## What should have happened

The console says what is missing, in her words: "Stripe needs a photo of your ID". When Stripe has everything and is checking it, the console says there is nothing to do.

## How to reproduce

1. Send Stripe's setup form with details Stripe cannot confirm.
2. Come back to Payment providers › sparx Pay.

## Why it matters

"Not finished" with no reason sends the owner back through a form she already filled in, looking for a mistake she cannot see.

## Where it lives

- `wizeworks/services/api-rest/src/lib/payments-onboarding.ts` (`SparxPayStatus.due`, `.checking`).
- `sparx/apps/workbench/surfaces/commerce/providers-data.ts` and `payment-provider-detail.tsx`; the same two in `piggles/apps/workbench`.

## The fix

- The API passes on what Stripe still needs (`due`: past due and currently due, once each) and whether Stripe is checking (`checking`).
- `sparxPayNeed` turns Stripe's keys into words: a photo of your ID, your bank account for payouts, your OK to Stripe's terms, your Social Security number, your business's tax ID, your date of birth, your address, what kind of business it is, the name buyers see on their card statement, a few words about your business, who owns and runs the business, your name and contact details, or "a few more details" for a key it does not know. The two in the middle were added when a brand-new account's own list showed "a few more details" for `business_type` and `settings.payments.statement_descriptor`.
- The pane shows a warning, "Stripe needs a photo of your ID", with "Continue setup to add it. Card payments start once Stripe has it." While Stripe checks, it says "Stripe is checking your details. There is nothing for you to do."
- Both consoles. Piggles hides sparx Pay, so its copy is for parity.

Tests: `providers-data.test.ts` in both consoles (5 each: the words, once each; checking; nothing once live or before setup; every key a new account starts with, none of them "a few more details"; the fallback). API: 2 in `payments-onboarding.test.ts`.

## Confirmed by

2026-10-18, on a business whose sparx Pay was never started, since Gillett's account was live by then. As Ines Varga (Quiet Bench Repair) in a headless browser: Set up sparx Pay opened Stripe's page (nothing filled in), and back on the pane it read "Stripe needs a few words about your business, what kind of business it is, your bank account for payouts, your date of birth, who owns and runs the business, the name buyers see on their card statement and your OK to Stripe's terms. Continue setup to add it. Card payments start once Stripe has it." Her own email was marked confirmed in the dev database first, because sparx refuses payments to an unconfirmed owner and the console could not send her the link ([337]).

## Rating effect

None.
