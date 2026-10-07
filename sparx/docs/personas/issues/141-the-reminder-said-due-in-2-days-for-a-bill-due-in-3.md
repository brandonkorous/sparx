# 141 — The reminder said "due in 2 days" for a bill due in 3

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 10 (reading the reminder email)
**Surface:** every invoice email: "Remind before a wholesale invoice is due", "Invoice reminder", the overdue notices
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01, 2026-10-06
**Blocked on:** —

## What happened

The rule that picks the bill and the email that describes it count days two different ways.

- The rule counts calendar days on the business's clock: Gillett's INV-000014, due Nov 3, is "3 days until due" all through Oct 31 in Denver.
- The email counts whole 24-hour periods from this moment to noon UTC on the due day. At 6:00pm Denver on Oct 31 (00:00 UTC Nov 1), that is 2.5 periods, printed as "2".

So the email "Invoice due in 2 days" goes out for a bill due in 3 days, and the same email body says "A reminder that invoice INV-000014 is due in 2 days", next to "Due date: Nov 3, 2026".

## What should have happened

The number in the email is the number the rule used: the same calendar count, on the business's clock. The overdue notices too ("is now 7 days overdue").

## How to reproduce

Render `b2b-invoice-due` for INV-000014 (due 2026-11-03 12:00 UTC) at 2026-11-01T00:00Z for a business in America/Denver: `invoice.daysUntilDue` is "2". `daysPastDue` gives -3.

## Why it matters

The customer reads a date and a count that disagree, in a message about money. It is the issue 099 defect, fixed in the rule and the screens and left behind in the email.

## Where it lives

- `wizeworks/services/api-rest/src/lib/email-data.ts`, `resolveInvoice`: `Math.floor((dueMs - now) / MS_PER_DAY)`.

## The fix

- `api-rest/src/lib/email-data.ts`, `resolveInvoice`: `daysUntilDue` and `overdueDays` come from `daysPastDue(dueAt, now, businessTimeZone)`, the count the rule used. The unused `MS_PER_DAY` went with it.

Siblings: the rule side (`billingFields`) and the screens already used `daysPastDue` ([099]). No other email field counts days.

Test, proved red:

- `api-rest/test/integration/email-data.test.ts`, "counts the days the way the rule that sent it did": a Denver shop, a bill due Nov 3; at 00:00 UTC Nov 1 the email says "3", and at 16:00 UTC Nov 4 it says one day late. The old count reads "2".

## Confirmed by

Renée's 4459 reminder, rebuilt with the sending code at 23:2x Denver time on Oct 6 (05:2x UTC Oct 7): "is now 7 days overdue … Days overdue 7", due Sep 29. Seven calendar days in Denver.

## Rating effect

—
