# 150 — A week the salon was shut was reported as somebody else's booking

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · standing check — dates
**Surface:** mypiggles › Bookings › Take a booking, and a booking's "Move it"
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Nia shuts the salon for a week in the summer. It is on her availability screen,
in her own words, under Closures & special hours:

> **Salon closed, summer week**
> Sun, Aug 1, 2027 – Sun, Aug 8, 2027 · Everyone

She then tried to book someone into it. The closure held — nothing was written,
which is right — and this is what she was told:

> **Could not take this booking**
> That time is no longer available

> **That didn't save**
> That time was taken while you were filling this in, so nothing was booked. Pick
> another time and everything else you typed is still here.

Nobody took it. **She shut the shop.** The sentence sends her back to the time
field to try 11:15, then 11:30, then Wednesday, then Thursday — eight days of the
same refusal, each one blaming a customer who does not exist, before she works
out on her own that the holiday she set is the thing in the way.

## Why it happened

`SLOT_UNAVAILABLE` was the engine's answer to every kind of no. The closure check
existed and worked — `busyResourceIds` folded closures into the same set as
"already allocated" — so by the time the error was raised, the reason had been
thrown away.

That message is the one issue 146 wrote, and it is correct for the case it was
written for. This is the same rule one layer further down: **where one outcome
has causes with different remedies, it needs more than one message**, and the
place to split it is where the cause is still known, not at the toast.

| Cause          | Remedy                                |
| -------------- | ------------------------------------- |
| a clash        | another time, same day                |
| **a closure**  | **another week, or lift the closure** |
| nobody working | inside the hours, or change the hours |

## Where it lives

- [packages/scheduling/src/slot-guards.ts](../../../../wizeworks/packages/scheduling/src/slot-guards.ts) (new) — `blockedResources`, `blockedError`
- [packages/scheduling/src/errors.ts](../../../../wizeworks/packages/scheduling/src/errors.ts) — `ClosedForDateError`
- [services/api-rest/src/app.ts](../../../../wizeworks/services/api-rest/src/app.ts) — the code reaches the surface as a 422

## The fix

The reason survives to the message, and the message names her own closure back to
her with the dates it covers:

> Nothing can be booked then: "Salon closed, summer week" runs from Sun, Aug 1,
> 2027 to Sun, Aug 8, 2027.

Three details worth keeping:

**It uses her label.** She wrote "Salon closed, summer week"; the software repeats
it rather than paraphrasing. Where an owner named no reason it falls back to "a
closure runs from…", which is still a different fact from "somebody took it".

**The end date is the day she would say.** The closure is stored ending at the
last instant of Aug 8, so the naive reading prints Aug 9. The text steps back a
second first.

**A closure outranks everything.** If a chair is both inside a closure and off
duty, the closure is the answer — it is a fact about the whole date, and it is the
one she can act on.

**Reschedule was checking none of this** and now does. A booking could be moved
into the closed week purely because the database's no-overlap constraint had no
opinion about holidays (this half is shared with issue 149).

## Still open — the customer's side of the same week

Her website, asked for a date inside the closure, says:

> No open times that day — try another date, or join the waitlist and we'll let
> you know the moment a spot opens.

Honest, and it never mentions the closure. A customer clicking through the week
gets that same sentence eight times. A salon shut for a named week would rather
say so once — that is a change to the public booking page's copy and its data,
not to this refusal, and it belongs with the buyer's-side standing check rather
than being smuggled in here. Recorded, not done.

## Confirmed by

> Re-ran it as Nia. **Take a booking**, Dry cut, Tue Aug 3 2027 at 11:00 AM: the
> pane reads **"Could not take this booking / Nothing can be booked then: 'Salon
> closed, summer week' runs from Sun, Aug 1, 2027 to Sun, Aug 8, 2027."**
>
> **Move it**, same date on an existing booking: **"That did not go through /
> Nothing can be booked then: 'Salon closed, summer week' runs from Sun, Aug 1,
> 2027 to Sun, Aug 8, 2027."** — and the booking's header still showed its old
> time, so nothing moved.
