# 100 — A first bill raised by hand could never be sent

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 6 (moving in O'Malley's old bill)
**Surface:** workbench › Wholesale › Raise an invoice; the invoice's full bill › Send (both consoles); automation "Invoice on terms: email it to the buyer"
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Doty raised 4471 for O'Malley Ranch, their first bill on sparx. "Invoice on terms: email it to the buyer" failed: "There is no email address to send this to." On the full bill, Send said "There is no email address on this invoice yet. Add one under Bill to first." The page above it said the invoice is locked, and every Bill to box was disabled. Seamus O'Malley was on the account as its buyer the whole time.

## What should have happened

A bill for a trade account goes to the account's people when nothing else names an address, the same rule its statement already used.

## How to reproduce

Raise an invoice by hand for an account with no earlier bill. Before the fix: Bill to has a name only, the automatic email fails, and Send is a dead end. Every time.

## Why it matters

The advice was impossible to follow, so the bill could not reach the customer at all. An invoice nobody receives is not chased and not paid.

## Where it lives

- `defaultOrderBillTo` (`crm/b2b-ar-service.ts`) looked at the account's last bill and the person who ordered; a hand-raised first bill has neither.
- The page's `billedToEmail` (`billing-document-service.ts`) and the email's own recipient (`billing-document-mail.ts`) each asked only the Bill to and the customer.
- The account-contact rule lived inside the statement service only.

## The fix

`account-contact-billing.ts` holds the rule once: the account's main contact first, then anyone who orders for it (`accountContactBilling`), and `documentRecipient` (Bill to, else customer, else those people). The statement, a new bill's Bill to, the page and the email all use it.

Tests, each proved red:

- `crm/src/services/account-contact-billing.test.ts`: the old recipient rule reddens 1 of 4.
- `crm/test/unit/ar-document-order-link.test.ts` "goes to the account's own buyer on a first bill raised by hand": reddens without the fallback.

## Confirmed by

On screen, 2026-10-06, as Doty: Send on 4471 reads "4471 goes to seamus.omalley@omalleyranch.test, with its lines, its total and anything written in Notes."; sent, recorded to that address. Then 4466 for Høgberg, raised by hand, was made out to Lars Høgberg at 1180 E Seltice Way, Post Falls, ID 83854 and emailed by itself.

## Rating effect

—
