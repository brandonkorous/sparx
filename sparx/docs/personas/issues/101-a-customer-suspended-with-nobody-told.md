# 101 — A customer was suspended and nobody was told

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 6 (after moving in O'Malley's 40-day-old bill)
**Surface:** automation "Chase overdue wholesale invoices"; the notification bell; workbench › Wholesale › an account › Standing (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

A minute after Doty raised 4471 (40 days late), the locked late-payment ladder suspended O'Malley Ranch. Nothing in the bell, no task, no email to him. The account page read "Suspended" over the same help line it shows for every standing: "Put them on credit hold to stop new orders until they've paid what they owe." Not who did it, not why, not what to do.

## What should have happened

When the platform stops a customer ordering on its own, the owner hears about it and the account says why and how to lift it. Lifting a suspension is a person's decision after payment (docs/10 §9), so that person has to know.

## How to reproduce

Raise a wholesale bill more than 30 days past due (or 14, for a credit hold). Before the fix: the account changes standing within a minute and nothing says so. Every time.

## Why it matters

The customer is refused at checkout ("Account is suspended: contact your account manager") and calls a shop that does not know.

## Where it lives

`b2b.escalate_overdue` published `b2b.account.suspended` and `b2b.account.credit_hold`. No seeded automation listened to either, and the engine had no reader for `b2b.account.suspended` at all. The account page's help was one fixed sentence.

## The fix

- Two system automations, "Wholesale customer suspended: tell me" and "Wholesale customer on credit hold: tell me": a notice in the owners' bell naming the business and how late the bill is, opening the account.
- The engine reads `b2b.account.suspended` (it read only credit holds).
- `standingHelp` (`surfaces/b2b/accounts-data.ts`, both consoles): what the chosen standing means, that it was set on its own at 14 or 30 days late, that paying up front still works, and how to lift it.
- A new check: every event-triggered built-in automation that fills fields listens to an event the engine can read. Every one does.

A notice and not a task: the house rule is that a seed's task closes itself, and this one reports what happened. A task would stay open after the account was opened again.

Tests, each proved red:

- `automation-actions/src/seeds/b2b-account-standing-seeds.test.ts`: removing the new reader reddens 2 of 4.
- `surfaces/b2b/standing-help.test.ts`, both consoles: the old single sentence reddens 3 of 3.

## Confirmed by

On screen, 2026-10-06, as Doty: moved in Høgberg's old invoice 4466 (20 days late); within a minute Høgberg went on credit hold and the bell read "Høgberg Diesel & Performance is on credit hold: a bill is 20 days late". Clicking it opened the account, whose Standing read "They cannot order on account until this is lifted. Paying up front still works. This is set on its own when a bill is 14 days late. Set Open for orders when you are ready."

O'Malley's suspension came before the fix, so it has no notice; its account page now explains it.

## Rating effect

—
