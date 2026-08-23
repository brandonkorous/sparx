# 149 — The lunch break she set was only enforced on her website

**Status:** fixed
**Severity:** blocker
**Found by:** P02 · Halo & Hem · standing check — dates
**Surface:** mypiggles › Bookings › Take a booking, and a booking's "Move it" · api-rest `POST /v1/scheduling/bookings` + `/reschedule`
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Nia's week is set up with a break in it. Tuesday to Saturday she works **9:00 AM
to 1:00 PM and 1:45 PM to 5:30 PM** — she added the second block herself, on the
screen that says in as many words "add more than one block for a lunch break".

Her diary draws the break. Switch the calendar to her name and the 1:00–1:45
strip is a darker band across every working day, and Monday and Sunday are dark
top to bottom.

Then the console booked a client into it. Dry cut, Tuesday, **1:15 PM**, with Nia
Okafor. No question, no warning, status **Confirmed** — and the block appeared in
the diary sitting inside the shaded band the same screen had just drawn to say
she is not there.

Moving one in was the same. Her own bookings were already in there: a 60-minute
Cut and finish at 1:00 PM on the Thursday and again on the Friday, and four more
on a **Monday**, a day the diary shades closed from top to bottom.

## The customer cannot do this

This is the part that makes it a blocker rather than a missing check. Her
website, the same afternoon, for the same person, the same service:

> 12:00 PM · 12:15 PM · 12:30 PM · **1:45 PM** · 2:00 PM · 2:15 PM …

The public page stops at 12:30 (a half-hour cut from 12:30 ends exactly at 1:00)
and picks up again at 1:45. It is correct to the minute.

So the hours meant one thing to her customers and nothing to her. A stranger on
the internet could not book Nia's lunch; Nia could, by accident, in two clicks,
and nothing on the screen told her she had.

## And the screen said it was refused

The diary's quick look carried this sentence directly above the button:

> Shown in your own time zone. **A time that clashes or falls outside opening
> hours is refused, and nothing changes.**

It is not an omission when the product states the rule. Moving a booking into the
break was accepted with that sentence on screen. The booking pane had its own,
different sentence — "The new time is checked for a clash before it takes" —
which was the same fact told two ways by two files, the shape issue 142 already
found on the cancel dialog.

## Why it happened

The availability engine has always known about working hours; the write path
never asked it. `busyResourceIds` in `booking-service.ts` looked at three things:

| Checked                        | Not checked      |
| ------------------------------ | ---------------- |
| existing allocations (clashes) | **weekly hours** |
| external calendar busy blocks  | **custom hours** |
| closures and blackouts         |                  |

`resourceFreeIntervals` — the function the public booking page's slots are built
from — was right there in the same package, unused by the half of the product
that writes.

Reschedule was worse: it kept the same resources and leaned entirely on the
database's no-overlap constraint, which knows about clashes and nothing else.

## Why it survived issue 106

Act 6 found this exact defect and fixed it — from the customer's side. [106] put
the guard in the PUBLIC booking route, as a pre-check that calls
`getAvailability` and refuses anything the slot grid would not have offered:

```ts
if (!slots.some((s) => s.startAtUtc === startAt.getTime())) {
  throw conflict('That time is no longer available');
}
```

That is a correct fix for the door it is on, and it is on one door. The staff
route calls `createBooking` directly, so the guard was never in its path; the
engine underneath both of them still had no opinion about hours.

The lesson is the one the persona rules keep making: **a check in a caller
protects that caller.** Moving it into the engine is what makes it true of every
way in — the public page, the console, MCP, a future integration — and the
route's own pre-check is now a harmless second line rather than the only one.

## Where it lives

- [packages/scheduling/src/slot-guards.ts](../../../../wizeworks/packages/scheduling/src/slot-guards.ts) (new)
- [packages/scheduling/src/booking-service.ts](../../../../wizeworks/packages/scheduling/src/booking-service.ts) — `pickForRole`, `rescheduleBooking`
- [packages/scheduling/src/errors.ts](../../../../wizeworks/packages/scheduling/src/errors.ts) — `OutsideWorkingHoursError`
- [surfaces/scheduling/booking-move-copy.ts](../../../apps/workbench/surfaces/scheduling/booking-move-copy.ts) (new) — the sentence, once

## The fix

**The write path asks the same question the read path asks.** `slot-guards.ts`
checks that the buffered span sits inside one of the resource's free intervals,
using `resourceFreeIntervals` and `contains` — literally the test `computeSlots`
runs to decide what to offer a customer. The two doors into the same salon now
apply the same rule by construction rather than by two implementations agreeing.

**A resource with NO hours at all is skipped, not treated as shut.** It has not
answered the question of when it works, and an absent answer must not be rendered
as a "closed" one — a tenant who has never opened the hours screen would
otherwise find every booking refused overnight.

**Clashes are still left to the database on the reschedule path.** The EXCLUDE
constraint is the authoritative guard, it handles a pooled resource (a class
several people share) correctly, and second-guessing it in application code would
refuse moves it would have allowed.

**The refusal names the hours**, because "pick another time" is useless advice
without them:

> Nia Okafor is not working at 1:15 PM on Tue, Sep 8, 2026. The hours that day are
> 9:00 AM to 1:00 PM and 1:45 PM to 5:30 PM.

Where nobody was pinned, nobody is singled out — naming Dara answers a question
that was not asked:

> No one is working on Mon, Sep 7, 2026.

**The two "Move it" sentences became one**, in `booking-move-copy.ts`, and it now
describes what the engine does: _"A time that clashes, falls outside working
hours, or lands in a closure is refused and nothing changes."_

## What the fix does not do

**It does not touch the bookings already inside the break.** Bilal Osei's 1:00 PM
Thursday cut and the four on that Monday stay exactly where they are. Enforcement
is on new writes, so nothing in her diary moved under her, and the record of what
actually happened is left alone.

**It does not add an override.** An owner who wants to open early for one client
has a real way to say so — the closures and special-hours section on the same
screen takes "a date you open different hours" — and inventing a second, hidden
one on the booking form would be a new capability rather than a repair.

## Confirmed by

> Re-ran all of it as Nia. **Take a booking**, Dry cut, Tue Sep 8, 1:15 PM, pinned
> to Nia: refused, with the pane and the toast both reading "Nia Okafor is not
> working at 1:15 PM on Tue, Sep 8, 2026. The hours that day are 9:00 AM to 1:00
> PM and 1:45 PM to 5:30 PM", and every field still filled in.
>
> **Move it**, on a booking sitting at Wed Sep 2, 1:00 PM: moving it to 1:15 PM
> refused with the same sentence and the header still reading 1:00 PM — nothing
> changed, as the sentence above the button now truthfully promises. Moving the
> same booking to 2:00 PM took, so a legal move still works.
>
> **Monday**, nobody pinned, Sep 7 at 10:00 AM: "No one is working on Mon, Sep 7,
> 2026."
>
> **The happy path**, Thu Sep 3 at 10:00 AM with nobody pinned: taken, Confirmed,
> assigned to Nia.
