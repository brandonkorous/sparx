# 082 — The buyer picked their own payment terms, and the invoice ignored the pick

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 5 (Renée Castañeda orders on account from the site)
**Surface:** site › checkout › Payment › Bill to my account
**Filed:** 2026-10-02
**Fixed:** 2026-10-02
**Confirmed by:** On screen, 2026-10-02, as Renée on the Gillett site: "Bill to my account" shows "Nothing is charged now. We add this order to your account, and you pay within 30 days of the invoice date." with no terms list. Order O-000007 ($528.00 at the Fleet price, $150.00 core deposit, PO WFUC-24-0823) made invoice INV-000001 for $678.00, due 2026-11-01 (Net 30), with the PO number on it. Wasatch Front's credit used went from $0.00 to $678.00.
**Blocked on:** —

## What happened

At checkout, "Bill to my account (net terms)" opened a form with a "Payment terms" list: Net 15, Net 30, Net 60, Net 90. Renée could pick Net 90.

The terms are the shop's to give, not the buyer's to choose. Gillett gave Wasatch Front Net 30.

- When the account had terms, the invoice used them and ignored the pick. A buyer who chose Net 90 was billed on Net 30, after the screen showed otherwise.
- When the account had no terms, the pick won. The customer chose how long they had to pay.
- Salt Lake County is on Net 45. Net 45 was not in the list, so the county's buyer could not even see their own terms.
- The "Bill to my account" button was gray `neutral`, and the Back buttons were too.

## Fix

- `wizeworks/packages/commerce/src/services/checkout-service.ts`: new `billedTerms(requested, accountTerms)`. The request is only the "bill this to my account" signal. The order is written on the account's own terms. An account with no terms is refused: "Your account does not have payment terms set up yet. Pay by card, or ask your account manager to set up your terms."
- `wizeworks/packages/commerce-schemas/src/checkout.ts`: the request accepts any `netN`, so a Net 45 account is not refused by the form.
- `wizeworks/apps/site/lib/account-terms-words.ts` (new): `canBillToAccount` and `accountTermsSentence`.
- `wizeworks/apps/site/components/checkout/payment-step.tsx`: no terms list. The screen states the account's terms in a sentence. "Bill to my account" is offered only to an account with day terms. The PO box explains what it is for. The button is `primary` outline; the Back buttons are colorless.

## Proof

- `checkout-terms.test.ts` (3 new tests). Putting the old rule back (the buyer's pick wins) reddens 2.
- `account-terms-words.test.ts` (3 tests). Offering terms to an account with none reddens 1.
