# 097 — Raise an invoice ignored the account's terms

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 6 (moving in O'Malley's old bill)
**Surface:** workbench › Wholesale › Invoices › Raise an invoice (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Raise an invoice opened due Oct 20, two weeks out. Doty chose O'Malley Ranch (Net 15) and the date stayed Oct 20. For Wasatch Front (Net 30) it would have been sixteen days early. At the same moment the Amount box turned red, "Enter how much this invoice is for.", before he had touched it.

## What should have happened

Choosing the account sets the due date from that account's terms and says so, until he picks a date himself. A box speaks up once it has been used, or when Raise is pressed.

## How to reproduce

As Doty, Raise an invoice, choose O'Malley Ranch. Before the fix: due Oct 20 and a red Amount, every time.

## Why it matters

A bill typed by hand is due on the day the agreement says. A default that silently ignores it puts a wrong deadline on a real debt, and a form that scolds before it is used reads as broken.

## Where it lives

`InvoiceCreate` in `surfaces/b2b/invoice-detail.tsx` (both consoles): a fixed `defaultDueDate()` (14 days, and read as the UTC day, so already tomorrow every evening), and one `touched` flag for the whole form.

## The fix

- `dueDayFor(terms)` in `lib/payment-terms.ts`: the reader's day plus the agreed days. The form uses it while the date is not chosen by hand, and the box says "O'Malley Ranch & Hay Co.: 15 days to pay, counted from today."
- Each box shows its own warning once used; every box speaks when Raise is pressed.
- The account choices carry their terms.

Test: `lib/due-day-for.test.ts`, both consoles. The old 14-day rule reddens 3 of 3.

## Confirmed by

On screen, 2026-10-06, as Doty: O'Malley Ranch gives Oct 21 with the sentence above and no red Amount; Høgberg (Net 30) gives Nov 5. Typing Aug 27 by hand keeps Aug 27 and drops the sentence.

## Rating effect

—
