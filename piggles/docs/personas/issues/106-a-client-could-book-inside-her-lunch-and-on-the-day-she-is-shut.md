# 106 — A client could book inside her lunch, and on the day she is shut

**Status:** fixed
**Severity:** blocker
**Found by:** P02 · Halo & Hem · act 6
**Surface:** the public booking API — `POST /v1/public/scheduling/bookings`
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** the same three posts, and a booking made from the screen · 2026-08-22

## What happened

The persona's acceptance test for act 6 is one sentence: **"Try to book Monday.
Try to book 13:15. Both must be impossible."**

On the screen, both are impossible, and beautifully so. Monday 31 August, on the
booking page for Cut and finish:

> **No open times that day** — try another date, or join the waitlist and we'll let
> you know the moment a spot opens. **[Join the waitlist]**

Thursday 27 August with Nia chosen: the grid runs 9:00 AM … 12:00 PM, then jumps
straight to 1:45 PM. Her lunch is 13:00–13:45 and a one-hour cut cannot fit before
it. Every boundary is right to the minute.

**The server accepts both anyway.**

| Posted to the public booking endpoint            | Response        |
| ------------------------------------------------ | --------------- |
| Thursday 27 Aug **1:15 PM** — inside Nia's lunch | **201 Created** |
| Monday 31 Aug **10:00 AM** — the salon is shut   | **201 Created** |

Two appointments, in her diary, at times her own opening hours say cannot happen.
No error, no warning, no flag on the booking.

## Why this is a blocker

**The hours are the product.** This persona exists to test a business whose product
is time: two people, different days, a 45-minute lunch, a week off in August. Every
one of those rules is enforced by the slot list and by nothing else.

That means the guarantee is only as good as the page a customer happens to be
looking at. Any of these ends with a real appointment at an impossible time:

- A booking page left open in a tab while Nia changes her hours or adds a closure.
- A double submit, or a back-then-resubmit, after the slot list has moved on.
- Any request that does not come from the widget at all.

And the failure is silent on both sides. The booking is `confirmed`; nothing on it
says it was made outside opening hours. Nia finds out when someone turns up while
she is eating, or on the Monday she is shut.

It also undercuts a promise the code makes about itself, in the widget's own
header comment:

> the slot list is what the engine's no-overlap guarantee will accept, so a
> confirmed time is real.

Overlap **is** enforced server-side — a second booking on a taken slot is correctly
refused with `409 SLOT_UNAVAILABLE`. Availability is not. The two halves of "is
this time real" were not given the same treatment.

## How to reproduce

Every time.

1. `POST /v1/public/scheduling/bookings` with a `startAt` inside a resource's
   break, or on a day with no working hours at all.
2. `201 Created`.

The screen will not offer those times, so reproducing it needs a request the widget
would not make — which is exactly the class of request a public endpoint has to
survive.

## Where it lives

[wizeworks/services/api-rest/src/routes/v1/public/scheduling.ts](../../../../wizeworks/services/api-rest/src/routes/v1/public/scheduling.ts),
the create handler. It validates carefully, and validates everything except the
time:

- the service exists, is active and is bookable online ✓
- a reservation carries a party size ✓
- a customer-chosen resource is genuinely eligible — "so a tampered id can't book
  an offline/foreign resource" ✓
- **the requested `startAt` is a time the business is open** ✗

`createBooking` then enforces no-overlap, which is why a taken slot 409s. Nothing
asks `getAvailability` — the function the slot list itself is built from, sitting in
the route directly above.

The comment on the resource check shows the standard the rest of the handler is
already held to. The time simply never got the same question asked of it.

## The fix

Ask the same engine the slot list asks, before creating anything:

```ts
const slots = await getAvailability(
  tenantId,
  { serviceId, from, to, …(resourceId ? { resourceId } : {}), …(partySize ? { partySize } : {}) },
  Date.now()
);
if (!slots.some((s) => s.startAtUtc === startAt.getTime())) {
  throw conflict('That time is no longer available');
}
```

Three things this gets right by construction:

- **One source of truth.** The check is the same computation as the grid, so a rule
  the grid honours is a rule the endpoint honours — including future ones. A
  separate re-implementation of "is she open" is how these drift apart again.
- **The same error the customer already understands.** A time that has gone
  already answers `409 SLOT_UNAVAILABLE` / "That time is no longer available", and
  a time that was never open is the same sentence from the customer's side.
- **It costs one query on the booking path only** — not on the read path, which is
  where the volume is.

## One detail the first attempt got wrong

The window handed to `getAvailability` was `[startAt, startAt + 1s)`, which refused
**everything** — the engine lays slots across the window it is given, and a window
narrower than a slot returns none. Caught because the check was re-run against a
time that was genuinely open, not only against the two that should fail. A guard
that refuses every request looks exactly like a guard that works, if the only
thing you test is the thing you expect it to stop.

It is a day either side now, which contains the whole working day in any timezone,
and runs once on the write path.

## Confirmed by

Re-run 2026-08-22, all three posts against the live endpoint:

| Requested                                        | Before      | After           |
| ------------------------------------------------ | ----------- | --------------- |
| Thursday 27 Aug **1:15 PM** — inside Nia's lunch | 201 Created | **409 refused** |
| Monday 31 Aug **10:00 AM** — the salon is shut   | 201 Created | **409 refused** |
| Thursday 27 Aug **3:00 PM** — genuinely open     | —           | **201 Created** |

And from the screen, to prove the happy path still works through the widget: Rob
Alvarez's skin fade with Dara, Friday 28 August at 10:30 — "You're booked".

## What it does not cover

An appointment the OWNER makes from the console is a different surface with a
different rule: she is allowed to squeeze somebody in over her own lunch, and
should be. This is the public endpoint only.

## Rating effect

The published booking page is scored in [rating.md](../rating.md).
