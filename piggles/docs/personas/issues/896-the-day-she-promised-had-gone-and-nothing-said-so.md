# 896 — The day she promised had gone, and nothing said so

**Status:** fixed
**Severity:** **major** — an order five days past the day it was agreed for read
exactly like one due next week, on the list and on the order's own pane. The
console calls a late bill late, a late deal late, and a late delivery from a
supplier late on a screen of its own. The one promise it would not call late was
the one made to a customer
**Found by:** P03 · act 318, sweeping Orders by data weight (29 orders, 44 lines)
**Surface:** mypiggles › Sell › Orders, and any order's own pane. Piggles only —
sparx has no made-to-order day
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** a guard of 10 assertions, proved red five ways; and her own
screen, before and after

## What she saw

One row on her orders list, on the thirtieth of September:

```
O-000018   Tamsin Vale   Sep 20, 2026   Part paid   To collect   $52.00
Due Fri, Sep 25
```

and, opening it, the first thing on the pane:

```
Due Friday, September 25
Something on this order has to be made first, so this is the earliest day it
can be collected. It was agreed when the order was placed and does not move if
you change the product afterwards.
```

Present tense, about a day that had been and gone five days earlier. The line on
the list wore `text-module`, one fixed color, the same it would wear for a day
next month. Neither screen said the day had passed.

## Measured

Every live promised day on the platform, at the moment of filing:

```
orders still waiting, with a day promised, past that day      1
orders still waiting, with a day promised, not yet there      0
```

One of one. The feature exists to be watched, and the only instance of it there
has ever been to watch was a broken promise that nothing reported.

## The console already knew how to say this

`readyOn` is read in exactly three places, and not one of them counts:

```
orders-table.tsx        prints the date          ← the list row
order-detail-due-day.tsx  prints the date        ← the order's own pane
order-detail-parties.tsx  tests it for null      ← not about the day at all
```

Meanwhile, four other promised days in the same console all say "N days late" in
a red:

```
a bill she owes            billState()        finance/format.ts
a deal she is chasing      dealDueSignal()    crm/deals-data.ts
an invoice owed to her     invoiceState()     b2b/invoices-data.ts
stock late from a supplier                    a whole screen, What is overdue,
                                              sorted by money at stake
```

`lib/console/days.ts` carries `daysPastDue` and calls itself the console's one
rule for this. Eight files ask it. The orders list did not, and formatted its
own date instead. [[feedback_a_fix_leaves_its_neighbour_behind]]

## A promise in the future tense about a day in the past

The pane's sentence is not merely quiet. It is wrong by the time it matters:
"this is the earliest day it can be collected" describes a plan, and there was
no longer a plan. A sentence about what happens next is testable, and this one
had no branch for the outcome it most needed one for.
[[feedback_a_promise_in_copy_is_a_contract]]

## What it does now

A new `dueDaySignal` in `lib/console/days.ts`, beside `daysPastDue` where the
rule already lives rather than as a third copy of the words:

```
5 days past    "5 days late"     danger
1 day past     "1 day late"      danger
today          "Due today"       warning
tomorrow       "Due tomorrow"    warning
within a week  "Due in 5 days"   warning
further out    (no words)        module     ← the caller prints the date
```

The row, and the pane:

```
O-000018   Tamsin Vale   Sep 20, 2026   Part paid   To collect   $52.00
5 days late · Fri, Sep 25                                   ← red

5 days late · due Friday, September 25                      ← red alert
This was the day it was agreed for, and it has gone by. It is still to collect,
so tell Tamsin where it stands and agree a new day if you need one.
```

The count leads and the day follows, because the count is the fact she acts on
and the day is the one she quotes down the phone.

**Counted on her calendar, not this computer's.** Both screens pass the
business's zone, the same as the bills list and the supplier report. It is the
30th in Denver and already the 1st in UTC as this is written, so an order due
today would read "1 day late" counted the server's way. A test pins exactly
that.

**A finished order is not late.** An order already collected or sent keeps the
"Was due" it always had. Telling somebody a job they completed is five days
overdue buries the ones that still are.

## Narrow panes

The due line is `whitespace-nowrap` and is therefore the widest thing in its
column, which makes it the thing that decides how much room is left for the
money. Measured at a 360px pane:

```
                             table width    overflow
before this issue                   368          41
with the full new line              406          79   ← would have been mine
with the line shortened             368          41   ← shipped
```

Under `@sm` the row says only **"5 days late"**; the day comes back as soon as
there is room. The pre-existing 41px is unchanged.

## Proved

**10 assertions**, and five wrong versions:

```
the rule stops calling a past day late          →  3 fail
the orders row stops asking the rule            →  1 fail
the pane formats its own day again              →  1 fail
the row goes back to one fixed ink              →  1 fail
the zone stops being threaded through           →  1 fail
```

Six of the ten drive the rule itself from both sides of today, because the bug
was that one side of today rendered as the other. The other four read the two
source files, because a rule kept in a shared helper is only kept while the
screens keep calling it — and nothing about a hand-rolled `toLocaleDateString`
fails a type check or a render test. [[feedback_structural_checks_go_blind]]

The call is matched on its open bracket, never on the name alone: an unused
import is the exact residue a deleted call leaves behind, which is how a guard
of mine stayed green over a fix I had just removed (issue 894).
[[feedback_a_test_that_cannot_go_red]]

## Checks

Piggles console 174 files / 1629 tests, green. Typecheck 0. ESLint and prettier
clean. `check:column-floor` green (209 of 1211 surfaces declare floors), and the
six piggles copy checks pass.

## Files

- `piggles/apps/workbench/lib/console/days.ts`
- `piggles/apps/workbench/surfaces/commerce/orders-table.tsx`
- `piggles/apps/workbench/surfaces/commerce/order-detail-due-day.tsx`
- `piggles/apps/workbench/lib/console/due-day-signal.test.ts` (new)

## Also checked and correctly not filed

**The chips say different words from the column.** The filters read All · Still
owed · To pack · Packed · They have it · Canceled, and the Delivery column reads
To send · On the way · Collected · To collect. That is deliberate and written
down: a chip names the WORK and the same stored status covers both posting and
collecting, so a chip called "To send" was returning orders the same table
marked "To collect". `orders-list-filters.test.ts` fails any chip that names a
delivery method.

**Every chip's count.** Measured against the database, all five exact:

```
Still owed 22 · To pack 11 · Packed 11 · They have it 4 · Canceled 2
```

11 + 11 + 4 + 2 + one refunded = 29, which is what "Showing 1–29 of 29" says.

**"Part refunded" on O-000005.** $147.00 ordered, $147.00 captured, $42.00 back.
Stored as `partially_paid`, which reads as a debt. The console already overrides
the stored word with the money and says "Paid in full, and some of it has since
gone back. Nothing is owed." Fixed earlier, correct now.

**The order number looked like a zero.** `O-000029` rendered with what appeared
to be a slashed leading character. Read out of the page: character code 79, the
letter O. Geist Mono slashes the DIGIT zero and leaves the capital plain, which
is the whole reason to set an identifier in that font. Working exactly as
intended.

**The table scrolls sideways at 360px.** 41px, with the money the part that goes
over the edge. The give-cell idiom that normally prevents this
(`w-full max-w-0 min-w-56`, so the NAME pays and never a number) does not fit
here: this table's naming column holds an order number, which the file says must
never break across lines, so it has no give to give. Its own comment names
scrolling as the fallback for exactly that case. Deliberate, and unchanged by
this fix.

## The thing to remember

**A date is not a signal until something says which side of today it is on.**
Both screens printed a true date in a calm color and stopped. Nothing rendered
wrongly, nothing was missing from the database, and no check could see it,
because "Fri, Sep 25" is the correct string for the 25th of September whatever
today happens to be.

The measurement that finds it is **"find every promised day in the product, and
ask which of them can tell you it has passed."** Four could. The one facing the
customer could not.
