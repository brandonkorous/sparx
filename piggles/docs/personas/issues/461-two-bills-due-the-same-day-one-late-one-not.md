# 461 — Two bills due the same day, one late and one not

**Status:** fixed
**Severity:** major
**Found by:** Devi opening "Owed to you" — $1,645.50 across 9 invoices
**Surface:** `finance.receivables` + the AR aging report, the dunning ladder, the B2B credit-hold ladder, the AR status machine
**Filed:** 2026-09-09

## What was wrong

Nine invoices, eight of them printed **Due Sep 8, 2026**. Seven said **1 day
late**. One said **Not yet due**.

```
INV-000004   Wren Ashcombe        1 day late    Sep 8, 2026   $276.00
INV-000010   Anneliese Vogt       1 day late    Sep 8, 2026   $152.00
INV-000001   Marguerite Adeyemi   Not yet due   Sep 8, 2026   $234.60
```

$234.60 sat under **Not yet due** while identically-dated invoices sat under
**1–30 days late**. She would not have chased it.

## Why

Lateness was elapsed milliseconds:

```ts
const daysPast = Math.floor((now.getTime() - dueAt.getTime()) / DAY);
```

| invoice    | due at    | elapsed   | floor |
| ---------- | --------- | --------- | ----- |
| INV-000004 | 02:41 UTC | 1.31 days | **1** |
| INV-000001 | 12:00 UTC | 0.93 days | **0** |

Both print "Sep 8" because the screen formats the due date as a **UTC calendar
day**, deliberately — `formatDay`'s own comment says _"A CALENDAR DAY, rendered as
the day it actually is."_ So the date a shop reads and the lateness she reads
were computed on two different bases, and the label was decided by a time she was
never shown.

A due date is a DAY. Nobody sets a due time; no screen shows one.

## Five copies of one question

Every place that asks "how late is this bill" had grown its own arithmetic:

| where                                 | what it decides                            |
| ------------------------------------- | ------------------------------------------ |
| `billing-ar.bucketAging`              | the AR aging report                        |
| `finance/receivables.ts`              | this screen, its own copy of the same line |
| `automation-actions/resolvers.ts`     | `invoice.overdueDays` — the dunning ladder |
| `crm/b2b-escalation-service.ts`       | credit hold and suspension                 |
| `automation-actions/b2b.ts` (raw SQL) | which accounts the B2B scan surfaces       |
| `billing-ar.deriveDocumentStatus`     | whether a document IS `overdue`            |

The dunning ladder matches on an **exact** day (`daysUntilDue == 3`,
`overdueDays == 7/14/30`), so under the old rule the day a customer got chased was
set by the hour the invoice happened to be raised at — an invoice raised at 4pm
chased a day later than the identical one raised at 9am.

## The fix

One exported `daysPastDue(dueAt, now)` in `billing-ar.ts`, counting **calendar
days in UTC** — the same basis the date is displayed in, so the number and the
printed date can never disagree. Every one of the six now calls it. The SQL copy
became `(now() AT TIME ZONE 'UTC')::date - (due_at AT TIME ZONE 'UTC')::date`,
which is simpler as well as right.

Two related bounds moved with it: a document is `overdue` only once its due DATE
has passed, and the B2B scan's "past due" filter is now a date comparison. Both
had marked a bill overdue partway through its own due date and stamped it
`overdueDays: 0` — a row saying "overdue by no days".

## Why the tests never caught it

`billing-aging.test.ts` builds every due date with
`new Date(NOW.getTime() - n * 86_400_000)` from a midnight `NOW`. **At midnight
the two rules agree for every input**, so the buggy reader satisfied all four
tests perfectly. `billing-ar.test.ts` uses midnight constants too.

That is [[feedback_a_test_that_cannot_go_red]] exactly: an assertion the wrong
implementation also passes. Five new cases use real due TIMES — 02:41, 12:00,
23:59 — which is the only shape that can tell the rules apart.

| breaking                               | reddens                                                         |
| -------------------------------------- | --------------------------------------------------------------- |
| restoring `floor((now - dueAt) / DAY)` | 3 — `expected +0 to be 1`, and $234.60 back in the wrong bucket |

The original six still pass with the bug restored, which is the proof they could
never have caught it.

## On screen

Before: `Not yet due $893.60` · `1–30 days late $751.90`.
After: `Not yet due $659.00` · `1–30 days late $986.50`, and INV-000001 reads
**1 day late**. The $234.60 moved exactly as predicted; the $1,645.50 total is
unchanged.

## One stale comment, fixed with it

`receivables.ts`'s file header still said it "buckets them on the stored
`overdueDays`". The code stopped doing that some time ago — an inline comment
five lines from the query explains why the stored column is too stale to trust —
and the header had gone on saying the opposite ever since.
