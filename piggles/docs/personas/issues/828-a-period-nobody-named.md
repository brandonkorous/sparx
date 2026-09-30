# 828 — A period nobody named, and a warning with no way out

**Status:** fixed
**Severity:** correctness + copy
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles workbench — the five Team panes and the five Bookings panes
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi, at full width and at 390px

## $0.00 this period, and no period

Timesheets prints three cards, and every figure on all three is "this period".
The period is chosen by a month picker, and the month picker sits in the
toolbar's `controls` slot.

**`controls` folds into the overflow on a narrow pane.** That is what the slot is
for and it is right. It also means that on a phone the screen reads:

> **What this period costs**
> $0.00 this period

with nothing anywhere on it saying which period. Not a wrong number. A number
with no unit, which is the same defect as the revenue axis drawn in cents on the
Sales dashboard (issue 823): the figure is correct and the reader cannot use it.

Three panes had the identical shape, each with the control that names the span
tucked in the same folding slot:

| Pane                   | The figures said | The span was chosen by |
| ---------------------- | ---------------- | ---------------------- |
| Timesheets             | "this period"    | a month picker         |
| Schedule               | "this week"      | a week stepper         |
| How bookings are going | nothing at all   | a range dropdown       |

All three now say the span on the toolbar's left, where nothing folds.

**Spelled once, not twice.** Schedule already drew the date range inside its week
stepper. Adding a second copy to the bar would be two places to keep in step, so
the range moved into a `weekLabel(from, to)` helper and both call it. The same
for Timesheets (`periodLabel`) and for the report range, which reads its label
straight out of `RANGE_PRESETS`. If the two ever disagree, they disagree because
somebody changed one function.

## A warning about a door that is not there

Linked calendars, in amber, at the top:

> **Calendar sync is not set up yet**
> This account cannot link outside calendars until sync is switched on for it.
> Your bookings are unaffected.

Read it as Devi. Something is not set up. Nobody is named as the one who has not
set it up. "until sync is switched on for it" is passive with no actor, so the
sentence reads as a chore waiting on her — and there is no screen in this console
where she could do it, because `cryptoOff` means an encryption key is missing at
**our** end.

Then, four inches below, the empty state finished the job:

> Once you link a calendar **above**, the times its owner is busy elsewhere will
> show as unavailable in your diary.

There is nothing above. The pane had replaced the linking form with the warning.
So the screen told her to do something impossible, and then pointed her at a
control it had itself hidden.

Both now say the same thing, and the warning carries a **Send us a message**
button wired to the feedback composer, so the one action available to her is on
the screen that told her she needed it. A warning with no way to act on it is
half a message. [[feedback_one_outcome_two_causes]]

## A noun where an action belongs

Repeating bookings labelled both of its buttons **"Repeating booking"** — the
toolbar primary and the empty state's call to action. A button says what pressing
it does. This one said what the thing is called, which is what the heading four
lines above it already said.

They read **"New repeating booking"** and **"Set one up"**.

Small, and worth writing down, because the two are not the same mistake made
twice: the empty state's neighbour on Waiting list already said "Add someone",
correctly, so the house pattern existed and this pane did not follow it.

## Nine bars with nothing on the left

Nine of these ten panes had a toolbar whose left side was empty — no name, no
count, nothing — because their only chrome was a filter or a picker, and those
live in `controls`, which folds. Continues the sweep from issue 824, where 171 of
689 toolbars were measured as saying nothing on their left and 72 of those were
list panes.

The counts obey the rule from issue 822: `statusReady` and `statusFailed` are
passed, so none of them prints "0" while the answer is still on its way, and none
of them prints "0" forever after a read that failed.

Time off is the one worth copying. Its status is not a count of rows, it is
**what is waiting on her**, falling back to what is already booked:

> 2 waiting on you ← or, when none is — 3 booked

A count of everything is the easy status. A count of what needs her is the useful
one.

## Files

- `piggles/apps/workbench/surfaces/staff/{timesheets,schedule,people,time-off,certifications}.tsx`
- `piggles/apps/workbench/surfaces/staff/format.ts`
- `piggles/apps/workbench/surfaces/scheduling/{reports,calendar-connections,series-list,series-detail,waitlist-list}.tsx`

## The thing to remember

**A control that folds cannot be the only place a fact is stated.** `controls`
and the overflow menu are a responsive mechanism working exactly as designed, and
that is precisely why a screen must not depend on them to carry meaning. Anything
the figures on a pane are measured AGAINST — a period, a week, a site, a currency
— belongs on the toolbar's left, which never folds.

Worth checking the same shape on every other pane with a range picker.
