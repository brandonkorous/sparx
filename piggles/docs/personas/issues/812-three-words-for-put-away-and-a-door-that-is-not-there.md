# 812 — Three words for "put away", and a door that is not there

**Status:** partly fixed
**Severity:** copy
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles workbench — `crm.meeting-links`, `crm.pipelines.list`, and ~26 more
**Filed:** 2026-09-25
**Fixed:** 2026-09-25 (the booking links pair and the pipelines pane)
**Confirmed by:** seen on screen as Devi
**Blocked on:** the console-wide sweep needs one word chosen for all of it

## 1. A door that is not there — fixed

**Booking links** told Devi, twice:

> A booking link points at one of your bookable services. That is where the
> length, your availability and your cancellation terms come from. **Set one up
> under Scheduling, then come back.**

and, on the disabled button's tooltip:

> Set up something bookable under **Scheduling** first

There is no Scheduling in this console. That is the other product's name for
the app; this rail says **Bookings**. She would have gone looking for a door
that is not there, twice, from the one screen that exists to explain the
blocker.

Advice that names the wrong place is worse than no advice.
[[feedback_one_outcome_two_causes]]

Both now say Bookings. Swept: "Scheduling" appears in **no** rendered Piggles
string any more — every remaining hit is an identifier (`useSchedulingServices`)
or an import path.

**A guard was tried and rejected.** Adding `Scheduling` to
`BANNED_IN_PRODUCT_COPY` immediately flagged _"Writing and scheduling posts
needs an editor or admin role"_ on the social composer, where "scheduling" is
the ordinary verb. Banning a common English word to catch a proper noun is a
worse guard than none, so the lexicon was left at its 22 words.

## 2. The booking links first-run state had no card — fixed

A bare `<Heading>` and `<Text>` floating in the column, which is precisely what
`components/pane-empty.tsx` says in its own header it exists to stop. It is a
`Card` with `PaneEmpty` and this app's artwork now, like its neighbours.

## 3. Three words for one state — measured, one pane fixed

This console says **"Put away"** for hidden-but-kept, and means it: the
all-apps dialog puts an app away, and the record-type editor confirms with
_"It stops appearing in your sidebar and search. Everything already recorded is
kept and comes back if you restore it."_ That is a good plain phrase and it is
a deliberate choice.

It is also only one of three. Counted 2026-09-25 across rendered strings in
`piggles/apps/workbench/surfaces` and `components`, comments and identifiers
excluded:

| word     | rendered uses |
| -------- | ------------- |
| archived | 13            |
| retired  | 13            |
| put away | 9             |

All three describe the same thing: hidden from the lists, the data kept, and
restorable. A pipeline is "archived", a discount is "retired", a record type is
"put away", and it is one state under three names.

**What is fixed:** the pipelines pane, because this act put the third word on
it. The filter read "Including archived" before act 281; it briefly read
"Including retired" because of a change made an hour earlier in this same act,
which added to the drift rather than settling it. Both the filter and the row
badge now say **put away**, so at least that pane agrees with itself.

**What is not:** the remaining ~24 sites. Choosing one word for all of them is
a console-wide call, and half-doing it adds a fourth inconsistency instead of
removing three. The measurement above is what the choice needs.

The recommendation is **put away**, because it is the only one of the three
that a person who has never used business software would read correctly on
first sight, and because the console already explains itself in those words.

## Files

- `piggles/apps/workbench/surfaces/crm/meeting-links-body.tsx`
- `piggles/apps/workbench/surfaces/crm/meeting-links-toolbar.tsx`
- `piggles/apps/workbench/surfaces/crm/pipelines-list.tsx`
