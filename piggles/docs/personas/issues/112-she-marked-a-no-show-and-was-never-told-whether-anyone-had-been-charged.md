# 112 — She marked a no-show and was never told whether anyone had been charged

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 7
**Surface:** mypiggles › Bookings › a booking — Mark no-show, and Cancel booking
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** P02 · Nia · both dialogs and the booking itself 2026-08-22

## What happened

Margot did not turn up for a **$180 full head of highlights**. Nia opened the
booking and pressed **Mark no-show**. The confirmation said:

> **Mark as a no-show?**
> This records that the customer did not turn up for the Thu, Aug 20, 2026,
> 2:00 PM booking and frees the slot. **Any no-show fee in your booking rules is
> applied.** — Back · They did not turn up

She pressed it. The booking went to **Did not turn up**, and the history recorded
"Marked as a no-show". **Nothing anywhere says what happened about the money.**

The same is true of Cancel, whose dialog says "Any deposit is handled by your
booking rules."

So after both of the two actions that touch a customer's money, the answer to
"have I just charged her, or not?" is not on the screen — not before, not after,
not in the history, and not on the booking.

## What was actually true

Three separate things, none of them visible:

1. Her **Color deposit** rule sets a $25 deposit and **no no-show fee at all**,
   so no fee could ever have applied. The dialog's "any no-show fee … is applied"
   was, for this business, always going to mean nothing.
2. No deposit was held either, because this tenant has no way to take one
   ([105](105-a-client-booked-her-most-expensive-appointment-and-was-told-it-had-failed.md)).
3. The settlement code is correct and complete — it captures a hold, forfeits a
   charge, or refunds, depending on the action and the policy
   ([scheduling-payments.ts](../../../../wizeworks/services/api-rest/src/lib/scheduling-payments.ts)).
   It simply returns early with nothing to do, and tells nobody that is what
   happened.

## Why it matters

A no-show on a $180 appointment is a money decision. The owner needs to know
which of these is true before she decides whether to ring the client:

- she has been charged $X, and it is settled;
- a hold was released and she has been charged nothing;
- nothing was ever held, so there is nothing to keep and this is money gone.

The third is the truth here, and it is the one that needs her to act. Silence
reads as the first — the dialog said a fee "is applied", so the natural reading
of a screen that then says nothing is that it was.

This is the shape this run keeps finding
([[feedback_never_present_absence_as_measurement]]): an outcome nobody recorded
rendering exactly like an outcome that went fine. And
[[feedback_one_outcome_two_causes]]: one sentence covering "a fee was taken" and
"there was never anything to take", which need opposite responses from her.

## The data is already loaded

`depositStatus` is on the booking the pane already has
([surfaces/scheduling/bookings-data.ts](../../../apps/workbench/surfaces/scheduling/bookings-data.ts),
`depositStatus: string | null`) and is rendered nowhere. It carries exactly the
distinction that is missing: `held`, `captured`, `forfeited`, `refunded`, or
null for a booking that never had one.

## The fix

**Say what is true about the money, before and after.**

1. **On the booking**, a line stating where it stands: "$25 deposit held",
   "$25 kept", "$25 returned", or — for a booking with none — "No deposit was
   taken for this booking."
2. **In both dialogs**, the sentence that applies to THIS booking rather than a
   hedge. With no deposit and no fee: "Nothing was paid up front, so no money
   changes hands." With a hold and a fee: what will be kept, and how much.
3. **In the history**, a line when money moves, so the record of the booking is
   the record of the money too.

The "no deposit" wording matters as much as the others. It is the case where the
business loses the whole appointment fee, and it is the one the screen currently
handles by saying nothing.

## Confirmed by

Re-run 2026-08-22, on the same $180 color appointment:

| Where          | Before                                              | After                                                       |
| -------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| On the booking | nothing                                             | **"Nothing was paid up front for this booking."**           |
| Mark no-show   | "Any no-show fee in your booking rules is applied." | **"Nothing was paid up front, so no money changes hands."** |
| Cancel booking | "Any deposit is handled by your booking rules."     | **"Nothing was paid up front, so no money changes hands."** |

**What is NOT proven on a screen:** the held / charged / kept / returned wordings.
No booking on this tenant has a deposit, because none can be taken
([105](105-a-client-booked-her-most-expensive-appointment-and-was-told-it-had-failed.md)),
so only the "nothing was paid" branch has been seen with eyes on it. The other
four are pure functions over `depositStatus` in
[booking-money.ts](../../../apps/workbench/surfaces/scheduling/booking-money.ts)
and read the same policy arithmetic the server settles with — but they are
unwitnessed, and this line is here so nobody reads the table above as covering
them.

## Rating effect

`Bookings › a booking` is scored in [rating.md](../rating.md).
