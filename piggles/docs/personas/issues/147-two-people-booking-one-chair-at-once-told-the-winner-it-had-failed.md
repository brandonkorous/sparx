# 147 — Two people booking one chair at once told the winner it had failed

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · standing check — wrong moves
**Surface:** mypiggles › Bookings › Take a booking · api-rest `POST /v1/scheduling/bookings`
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

The persona's third wrong move is "book the same 14:00 slot from two windows at
once". Nia's chair got three simultaneous requests for one slot.

**The data came out right.** One booking, every time. The `booking_resources`
no-overlap EXCLUDE constraint did exactly its job and there was never a double
booking, in any run, at any level of contention.

**What she was told came out wrong.** Alongside the successful booking, two
toasts:

> **That didn't save**
> Something went wrong on our end, so that didn't save. Nothing you typed was
> lost — try again in a moment. If it keeps happening, quote req_919b727a…

Nothing went wrong on our end. She had just booked the slot successfully, and the
console simultaneously told her twice that it had broken, and invited her to make
a fourth attempt at an appointment that already existed. From her chair there is
no way to tell whether the client is in the book or not.

## Why it happened

Postgres, not Prisma, has the answer. From the container log at the moment of the
race:

```
ERROR:  deadlock detected
CONTEXT:  while checking exclusion constraint on tuple (0,62)
          in relation "booking_resources"
```

That is SQLSTATE **40P01**, not 23P01. Two simultaneous inserts each wait on the
other's speculative check of the exclusion constraint, Postgres spots the cycle
and kills one. `isExclusionViolation` recognises only 23P01 and the constraint
name in the message, so a deadlock _while checking that constraint_ fell straight
through the translation the engine's own header promises — "we translate it into
a clean SlotUnavailableError instead of a 500" — and became a 500.

It is intermittent, which is why it survived: in the same session I saw the same
race produce a clean 23P01 and a 409 with the right message. Thirteen deadlocks
in forty seconds at eight-way contention, none at two-way.

## The thing not to do

Translating a deadlock into "that time is taken" would be the same lie in the
other direction. A deadlock does not mean the slot is gone; it means **the check
never finished**, so the answer is unknown. Reporting it as taken would refuse
bookings that would have succeeded.

## Where it lives

- [packages/scheduling/src/errors.ts](../../../../wizeworks/packages/scheduling/src/errors.ts) — `isTransientConflict`
- [packages/scheduling/src/booking-service.ts](../../../../wizeworks/packages/scheduling/src/booking-service.ts) — `withSlotRetry`, on create and on reschedule
- [services/api-rest/.../scheduling/bookings.ts](../../../../wizeworks/services/api-rest/src/routes/v1/scheduling/bookings.ts) — the header now says so

## The fix

**Run it again.** `withSlotRetry` re-runs the whole transaction on 40P01 or
40001, up to four attempts, with a jittered backoff — the backoff matters more
than the count, because retrying instantly puts the loser straight back into the
contention it just lost. The second attempt re-reads what is free and reaches a
real answer: the booking, or a clean `SlotUnavailableError` → 409 → the message
issue 146 rewrote.

Reschedule has the same shape against the same constraint and gets the same
wrapper.

## What is still true at extreme contention

Four attempts is sized for the real cases: a double-clicked button, two windows,
two people on the booking page at the same second. **Eight simultaneous requests
for one slot can still exhaust the retries**, and then the 500 stands, because at
that point the outcome genuinely is unknown and saying anything else would be a
guess. Before the backoff was added, eight-way contention leaked seven 500s in
three rounds; after it, thirty-two requests across four slots leaked none.

## Confirmed by

> Re-ran the race as Nia after the fix: four rounds, eight simultaneous requests
> each, on four fresh slots. Postgres logged **16 clean exclusion violations and
> zero deadlocks**; the console raised **zero** "something went wrong" toasts
> (checked by diffing the request-reference ids on the page before and after);
> every refusal read "That time was taken while you were filling this in". And
> `select start_at, count(*) from bookings` over those four slots returns **one
> live booking each** — the only slot with two rows has a cancelled Refusal Probe
> from act 7 on it, which the partial index correctly ignores.
>
> Before the fix, the same test logged 13 deadlocks in 40 seconds and put seven
> distinct `req_…` server-error toasts on screen.
