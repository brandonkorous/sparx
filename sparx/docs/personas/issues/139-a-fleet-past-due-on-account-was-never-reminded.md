# 139 — A fleet past due on account was never reminded

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 10 (the overdue reminder)
**Surface:** automations "Invoice overdue (7 days)", "(14 days: second notice)", "(30 days: final notice)"; the wholesale invoice ledger
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01, 2026-10-06
**Blocked on:** —

## What happened

Doty searched "overdue invoice reminder". Four rules came back: "Invoice overdue (7 days)", "Invoice overdue (14 days: second notice)", "Invoice overdue (30 days: final notice)", each "Emails the customer…", and "Chase overdue wholesale invoices", a locked rule that "marks past-due invoices overdue, places an account on credit hold … and suspends it".

Every Gillett invoice is a wholesale invoice on account. None of the three email rules can ever send for one: each says `invoice.workflowSlug neq net-terms-ar`, so it skips them. The locked rule changes the account's standing and tells Doty in his bell ([101]); it writes nothing to the buyer. O'Malley Ranch's 4471 is 40 days late and Høgberg's 4466 is 20 days late. Neither buyer has had a word about it.

The comment above the email rules says they skip wholesale invoices "so they never double up with the B2B credit-hold escalation, which owns net-terms AR dunning". The escalation sends no email, so there is nothing to double up with.

There is a second gate: the email rules want status `unpaid` or `partial`. The locked rule sets a late wholesale invoice to `overdue` the day it goes late, so even without the first gate they would miss it.

## What should have happened

A fleet that has not paid hears about it at 7, 14 and 30 days, like any other customer. sparx's pricing page lists "Automatic overdue reminders" under Invoicing, "Free with Commerce or B2B".

## How to reproduce

1. As Doty, raise and send a wholesale invoice for O'Malley Ranch due 7 days ago.
2. Wait for the daily rules. "Invoice overdue (7 days)" never runs for it (`automation_runs`: 0 rows).

## Why it matters

Chasing late trade bills by hand is the job Doty bought this to stop. The screen lists three reminder rules that look like they cover him, and none of them ever fires for a single one of his customers.

## Where it lives

- `wizeworks/packages/automation-actions/src/seeds/invoicing.ts`: `USER_INVOICE` in `overduePredicate`, and the `['unpaid', 'partial']` status list.

## The fix

- `automation-actions/src/seeds/invoicing.ts`: the 7, 14 and 30-day notices no longer skip `net-terms-ar`, and take `overdue` as an open status beside `unpaid` and `partial`. The 3-day reminder still skips the wholesale ledger, which has its own "due soon" email, so a fleet gets one reminder per bill, not two. The comment that said the credit-hold ladder "owns net-terms AR dunning" now says what that ladder does.
- Reaches existing businesses through the seed re-sync every release runs (`/internal/cron/reconcile-seeds?only=seeds`). Run locally the same way: Gillett's three rules now read `status in [unpaid, partial, overdue]` with no ledger gate.

Siblings: the "due soon" rules were checked and are right. Piggles uses the same seeds.

Test, proved red:

- `automation-actions/src/seeds/overdue-notices.test.ts` (7): a wholesale invoice gets each notice on its day, while still `unpaid` or once `overdue`; not after it is paid or when it was never sent; the 3-day reminder comes once. Against the old seeds, 4 fail; with only `overdue` taken out of the list, 3 fail.

## Confirmed by

On screen and in the run history, 2026-10-06, as Doty: raised 4459 for Wasatch Front (an old bill from his previous books, $2,119.60, due Sep 29, 7 days late). It went to Renée by itself. A minute later, with nobody touching anything, "Invoice overdue (7 days)" ran once for 4459 (23:15 Denver time) and queued the email to renee.castaneda@wasatchutility.test. The email, rebuilt with the code the sender uses (the event-worker's output is in Brandon's terminal, not readable here): "Invoice 4459 is overdue … was due on Sep 29, 2026 and is now 7 days overdue."

## Rating effect

—
