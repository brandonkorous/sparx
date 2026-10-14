# 187 — A fleet went over its credit and was not told why

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 13 (a fleet goes over its credit limit)
**Surface:** the Gillett site › checkout › Bill to your account; the order confirmation
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09
**Blocked on:** —

## What happened

Invoice 4459 was 10 days late, so Doty cut Wasatch's credit limit to $10,000.00. With
$8,323.92 used, $1,676.08 was left. Renée put five Bosch fuel rails in her cart at the
fleet price: $1,889.40, plus $136.98 Utah tax, $2,026.38. That is $350.30 past the credit
left.

Before Place order, the payment step said only: "This order is over Wasatch Front
Utility Contractors, LLC's $1,000.00 limit, so Teodora Vukić-Hale approves it before it
goes ahead." After it, the confirmation said: "Your order O-000022 needs two approvals:
one from Teodora Vukić-Hale, and one from Gillett Diesel Service."

The order was held for the right reasons (its record holds both: the $1,000.00 rule and
"over credit limit", $1,676.08 left of $2,026.38). Renée was told neither before nor
after that her account was out of credit, and was told one approval before the click and
two after.

## What should have happened

Before the click: the order comes to $2,026.38 and the account has $1,676.08 of credit
left, so Gillett approves it as well. After it: the same reason. "Limit" alone is also two
things on her screens: her account page says "Credit limit $10,000.00", and the checkout
said "$1,000.00 limit", which is the size of one order her colleague signs off.

## Why it matters

A promise in copy: she was told who would approve it, and that was wrong. And a fleet
buyer who does not know the account is out of credit cannot fix it (pay the late
invoice) before the order stalls.

## Where it lives

- `wizeworks/packages/commerce/src/services/checkout-service.ts` `previewApproval` asks
  only the spending-limit rule; `complete` also asks `accountOrderGate.termsDecision`.
  `commerce-schemas/src/checkout.ts` says so: "The credit limit is not foreseen here".
- `wizeworks/apps/site/lib/sign-off-words.ts`: `approvalPreviewSentence` and
  `heldOrderSentence` know only the spending limit.

## The fix

The payment step now asks the question the order asks, with the same function.

- `wizeworks/packages/commerce/src/services/checkout-credit-preview.ts`:
  `creditPreviewOf(account, total, currency)` runs `accountOrderGate.termsDecision`, the
  rule `complete` uses, for an account on terms. The checkout session carries it as
  `creditPreview` (`commerce-schemas/src/checkout.ts`; the comment that said credit "is
  not foreseen here" is gone).
- `complete`'s approval (`CheckoutApproval`) carries `overCredit` from the order's own
  hold reasons, and `@wizeworks/b2b` `accountOrderSignOff` carries it to the order page
  (`creditHoldOf`).
- The site (`lib/sign-off-words.ts`): on "Bill to your account" the notice gives both
  reasons and both approvers; the confirmation adds the credit sentence; the order page
  adds `overCreditSentence`. The spending limit now reads "limit for one order", since her
  account page also shows a credit limit.

Tests, red first: `checkout-credit-preview.test.ts` (commerce, 4),
`sign-off-words.test.ts` (site, 3 new and 8 reworded), `approval-credit-hold.test.ts`
(b2b). Commerce 529, schemas 619, site 439, b2b 107 pass; lint clean.

## Confirmed by

P01 on screen, 2026-10-09, as Renée on the Gillett site. Before Place order, five BD
flexplates billed to the account ($2,023.80 + $146.73 tax): "This order is over Wasatch
Front Utility Contractors, LLC's $1,000.00 limit for one order, and it comes to $2,170.53
with $1,676.08 of credit left, so it needs two approvals before it goes ahead: one from
Teodora Vukić-Hale, and one from Gillett Diesel Service." Not placed. On O-000022's own
page: "This order is over your account's $1,000.00 limit for one order. It comes to
$2,026.38, and your account has $1,676.08 of credit left." (reworded the same day by 188).

Then the business: Doty recorded Wasatch's check 20871 for invoice 4459 ($2,119.60),
credit used $8,323.92 → $6,204.32, approved O-000022; Teodora approved it on the site;
it was placed and INV-000021 ($2,026.38) issued; credit used $8,230.70, all as worked out
by hand. Not checked: the confirmation sentence on screen after a fresh placement
(covered by the test).

Same day, as Teodora: the "Waiting for your approval" card on her Wasatch page still read
"Over your account's $1,000.00 limit" beside "Credit limit $10,000.00". It now reads
"limit for one order" (`sign-off-words.ts`, test red then green).

## Rating effect

—
