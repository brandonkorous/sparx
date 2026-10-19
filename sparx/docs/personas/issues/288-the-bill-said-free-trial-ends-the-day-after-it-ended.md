# 288 — The bill said "Free trial ends" the day after it ended, and a custom plan read as $440 a month

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · confirming [261] (the trial ran out on Oct 15)
**Surface:** workbench › Finance › Your sparx bill
**Filed:** 2026-10-16
**Fixed:** 2026-10-16
**Confirmed by:** sparx as Doty and as the Everson owner, 2026-10-16
**Blocked on:** —

## What happened

On Oct 16 Gillett's 14-day trial had ended (it began Oct 1). The banner said "Your
trial has ended: paid features are paused". Your sparx bill, under it, said:

- "What you pay sparx $440.00 per month"
- "Free trial ends Oct 15, 2026" (a day already gone)
- a "Free trial" badge
- "No card on file yet. Set up billing to add your card and keep your plan active
  when the free trial ends."

Brandon then made Gillett what it really is, an Enterprise client on a custom plan
(docs/92 §10, `settings.billing.planType = "enterprise"`). The bill then said
"Custom plan" beside "What you pay sparx $440.00 per month", told Doty the list
below was "for reference", and still offered "Set up billing", which starts a
self-serve list-price subscription beside his agreement.

## What should have happened

- After the trial: say it ended, on what day, what is paused, and until when the
  website stays live. Badge it "Trial ended".
- On a custom plan: never print the list total as what he pays. Say the plan is
  agreed with the sparx team, show the features at list price as reference only,
  and offer no self-serve checkout before the team has set up his subscription.

## How to reproduce

1. Gillett, Oct 16 2026, standard plan, no card. Open Your sparx bill.
2. Read "Free trial ends Oct 15, 2026" and "Free trial".
3. Set Gillett to enterprise. Reopen. Read "What you pay sparx $440.00".

Every time.

## Why it matters

Two false sentences about money on the screen that is only about money. A business
on an agreed price reads a list price as its bill.

## Where it lives

`sparx/apps/workbench/surfaces/finance/subscription.tsx`: `planState` and
`renewalLine` read the raw `subscriptionStatus` ("trialing" stays on the row after
the trial ends), never the billing phase the bill already carries.

## The fix

- `surfaces/finance/subscription-words.ts` (new, pure): `planState` and
  `renewalLine` follow `bill.billing.phase` first. Grace: "Trial ended" (or
  "Payment due" for a failed renewal) and "Your free trial ended Oct 15, 2026. Your
  paid features are paused. Your website stays live until Oct 22, 2026."
  Suspended: "Site offline" and "Your website is offline, and your paid features
  are paused, until a card is added." A failed renewal says "Your last payment did
  not go through." instead of naming a trial.
- `subscription.tsx`: on a custom plan the headline is "Your plan is agreed with
  the sparx team" with no amount; the table is "The features you use, at list
  price", "For reference. Your agreement sets what you pay for them.", and its
  total row "List price in all". With no subscription set up yet, the card reads
  "No card on file. Your account contact arranges how you pay." and no button is
  offered; once the team sets one up, the portal opens as before. In grace the
  button reads "Add payment method", matching the banner.
- Siblings: Piggles hides this screen (`hidden.ts`), so it has no copy to fix. The
  staff console's tenant page still reads "Free trial ends {date}." for staff:
  not checked on screen.

Tests: `surfaces/finance/subscription-words.test.ts` (6). Against the old
`renewalLine` the grace, suspended and badge cases fail (it returned "Free trial
ends …" for any "trialing" row). ESLint and Prettier clean. The workbench `tsc`
ran out of memory: not checked.

## Confirmed by

sparx, 2026-10-16, on screen.

As Doty, Gillett's bill (custom plan):

- "Your plan is agreed with the sparx team. What you pay, and how, is set in your
  agreement. Your account contact arranges any change." Badge "Custom plan".
- "The features you use, at list price. For reference. Your agreement sets what you
  pay for them." Eleven lines, "List price in all $440.00/mo". No "What you pay
  sparx".
- "Card on file: No card on file. Your account contact arranges how you pay." No
  button in the pane body: no self-serve checkout.

As the Everson Apparel owner (trial ended Jul 26, 2026, no card, past grace):
"$392.00 per month. Your free trial ended Jul 26, 2026. Your website is offline,
and your paid features are paused, until a card is added." Badge "Site offline".
No "Free trial ends".

Grace week. Everson's trial end was moved to two days back (`2026-10-15 02:10 UTC`) and put back to `2026-07-26 08:52:50+00` after. The bill: "$392.00 per
month. Your free trial ended Oct 14, 2026. Your paid features are paused. Your
website stays live until Oct 21, 2026." Badge "Trial ended".

## Rating effect

—
