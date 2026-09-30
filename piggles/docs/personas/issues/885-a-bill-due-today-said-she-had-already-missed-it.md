# 885 — A bill due today said she had already missed it

**Status:** fixed
**Severity:** **moderate** — the list and the invoice disagreed, out loud, about
whether a payment had been missed. The one that said she was late was wrong, and
it was the one she was standing on when she decided whether to pay
**Found by:** P03 · act 315, sweeping Partners by data weight
**Surface:** mypiggles › Partners › What suppliers billed you; and On the way,
Overdue deliveries and the backorder screens, in both consoles
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** 9 tests, proved red three ways; and her own screen, before and
after

## What she saw

The list:

```
FT-INV-2291 · Fairfield Trims   Entered   Due today      $222.72
against PO-000002                         September 30, 2026
```

She clicked it. The same bill, one click later:

```
Due
15 hours ago
September 30, 2026 · invoiced September 15, 2026
```

**Due today** and **15 hours ago**, about the same invoice, in the same console,
over the same date. It was twenty past nine in the morning on September 30. She
had not missed anything.

## Measured

```
supplier bills on the platform            4     all of them Juniper Row's
  · due date stored at UTC midnight       4     4 of 4
  · unpaid                                4
  · due on the day she was reading        1     FT-INV-2291
```

Every supplier-bill due date on the platform is a day, not a moment. The pane
read all of them on the reader's clock.

## Two clocks, one line

A due date is a **day**. The console writes it that way:

```ts
const dueIso = dueAt === '' ? null : dayStartUtc(dueAt);
```

and prints it back that way, with `timeZone: 'UTC'` and a comment explaining
exactly why:

> _"A day-valued field is stored at UTC midnight, and handing UTC midnight to
> `toLocaleDateString` renders it on the READER's clock, which is the previous
> day for everyone west of Greenwich."_

The countdown directly above that date did not. It handed the same value to
silica's `<Timestamp format="relative">`, which is an **elapsed-time reading on
the reader's own clock**. So the headline and the line under it were two
different time systems reading one stored value, and the headline was the one
set in the largest type on the pane.

The list was never wrong: it asks the server for a **day count**, and
`Math.ceil((dueAt - now) / one day)` on a value stored at UTC midnight IS the
whole-day difference. The rule existed. One pane had not been told.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## It was not one line

The same question, asked the same wrong way, in five more places:

```
asn-detail                   expectedArrivalAt   relative
asn-list                     expectedArrivalAt   relative
purchase-order-procurement   expectedArrivalAt   relative
backorder-detail             promisedAt          absolute
backorders                   promisedAt          absolute
```

The two `absolute` ones are worse in a quieter way. `absolute` renders on the
reader's clock too, so a delivery promised for September 10 shows **September
9** for everyone west of Greenwich — the exact fault already measured, written
down, and fixed once in Buying. The comment above one of them reads _"a buyer
quoting the wrong one on the phone is how a business loses a customer twice"_,
and the component under it was shifting the day.

## The rule already existed, one folder away

The first version of this fix put the counting in Buying's own data file. That
was wrong in the same way the defect was, and the screen two tabs across said so:

```ts
// HOW LATE, COUNTED IN CALENDAR DAYS, IN THE SHOP'S OWN ZONE.
//
// The server counts elapsed seconds and divides by 86,400, in UTC. An order due
// on the 10th, read on the evening of the 18th in Los Angeles, came back as
// "9 days" because in UTC it was already the 19th. `lib/console/days.ts` is
// that rule, already written and already tested, for exactly this reason.
```

`lib/console/days.ts` counts **calendar days in the business's own zone**, takes
"today" from her clock and the due date from the stored UTC day so the count and
the printed date cannot disagree, and returns **null** rather than zero when
nobody set a deadline. Finance, invoicing and Overdue deliveries all use it. Its
own header records that the rule had been written twice before it existed, and
that invoicing never got either copy.

Buying's invoices were the next screen to not get it. So the second version of
this fix deleted the new arithmetic and added one function to that file instead:

```ts
daysUntilDue(dueAt, now, timeZone); // the same count, from the side screens ask from
```

Buying keeps only the words and the color, beside a note saying Money › Bills to
pay phrases the same fact slightly differently (`billState`: "3 days late",
"Due in 5 days"). Two vocabularies for one fact is worth settling and is a copy
decision about a shipped screen, not part of this.

The server's own `daysUntilDue` field is now read by neither pane, and its
comment says why: it divides milliseconds in UTC, so the hour a document was
raised at is part of the answer. It stays because other clients read it.

## Proved

**9 tests**, and three wrong versions:

```
ignore the business's zone              →  1 fail
count elapsed milliseconds              →  2 fail
the label counting today as overdue     →  2 fail
```

The first one nearly got away. Asserting only that Denver says "in 1 day" passed
with the zone argument removed, because **this computer is in Denver** — the
test proved nothing about the code and everything about where it ran. It now
asserts one instant against two zones, Denver and Tokyo, which no zone-blind
version can satisfy anywhere. [[feedback_a_test_that_cannot_go_red]]

The second pins the fault the shared file was written for: a due date raised at
eight in the evening must count the same as one raised at midnight. Elapsed
milliseconds let the hour on a stored date decide how late something is, which
once had eight invoices printed "Due Sep 8" reporting seven different answers.

**Checks:** piggles console 169 files / 1577 tests (2 failing in
`surfaces/migration/column-guess.test.ts`, an untracked file belonging to
another agent's in-progress work), sparx workbench 138 / 1259 all green.
Typecheck 0 on both consoles. ESLint and prettier clean. All 17 guards green.

**On her own screen**, FT-INV-2291 now reads **Due today**, the same words the
list uses, and AM-2198 reads **in 9 days** where it read "next week".

## Files

- `piggles/apps/workbench/lib/console/days.ts`
- `sparx/apps/workbench/lib/console/days.ts`
- `piggles/apps/workbench/surfaces/inventory/day-countdown.test.ts` (new)
- `sparx/apps/workbench/surfaces/inventory/day-countdown.test.ts` (new)
- both consoles' `purchase-orders-data.ts`, `supplier-bills-data.ts`,
  `supplier-bills-list.tsx`, `supplier-bill-detail.tsx`, `asn-detail.tsx`,
  `asn-list.tsx`, `purchase-order-procurement.tsx`, `backorder-detail.tsx`,
  `backorders.tsx`

## The thing to remember

**A component that formats time is not a component that formats dates, and
nothing about the call site says which one you are holding.** `dueAt` looks
exactly like `paidAt`. One is a day somebody typed, one is an instant something
happened at, and the same `<Timestamp>` renders both without complaint.

The measurement that finds it is not "does this date look right" — on nine days
in ten it does. It is **"what wrote this column?"** A field written through
`dayStartUtc` is a day for ever after, and every screen that reads it owes it
day arithmetic. Grep the writers, then go and look at the readers.

And the second lesson, which is the one I had to learn twice in the same hour:
**before writing the rule, look for it.** The first fix invented a correct
answer, and the file holding the right one was open two tabs away, with a
paragraph at the top explaining the exact bug I was fixing. That is the same
mistake as the defect, one level up.
