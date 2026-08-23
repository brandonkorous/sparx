# 142 — The question before cancelling an appointment never says whose

**Status:** fixed
**Severity:** blocker
**Found by:** P02 · Halo & Hem · standing check — wrong moves
**Surface:** mypiggles › Bookings — the booking pane, and the diary's quick look
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Nia meant to clear out a leftover test booking at 10:00 PM on Thursday. She hit
the row above it. The confirm that stood between her and a real client said:

> **Cancel Cut and finish?**
>
> This releases the Thu, Aug 27, 2026, 4:00 PM slot so someone else can take it,
> and lets the customer know. Nothing was paid up front, so no money changes
> hands. This cannot be undone.

She has **six** bookings called Cut and finish. The dialog is the same six times.
The one word that would have caught the wrong row — **Colette Mbeki** — is the
one word the sentence does not contain, and "the customer" is who it calls her.

She clicked through. Thirty-nine seconds later Colette had an email saying her
appointment was off.

## Why this is the worst place in the app for it

A confirm exists for exactly one purpose: to catch the click you did not mean to
make. It can only do that with the fact you were holding in your head when you
reached for the button, and for an appointment that fact is a **person**, not a
service name. A dialog that repeats the row's least distinguishing column and
then omits the most distinguishing one is a speed bump, not a guard.

The root file's rule is "name target + count loss". The target of this action is
somebody's Thursday afternoon.

## Two things the same dialog got wrong

**It promised a message it cannot always send.** "Lets the customer know" is
printed over walk-in bookings too, and a walk-in has no account — the engine's
`reachableChannels` returns nothing without a `customerId`, so nothing is sent
and nobody is told. Issue 134 fixed that sentence on the booking's notices
section and this dialog kept saying it.

**It was written twice.** The diary's quick-look modal has its own copy of both
questions, and it was still carrying the pre-112 hedges — "Any deposit is settled
by your booking rules", "Any no-show fee in your booking rules is applied" — which
is precisely the wording issue 112 exists to have removed. One question with two
authors is how a fix lands on half a product. The modal also named who from the
customer record alone, so the two walk-ins taken by name in act 10 were "For"
nobody there while the rest of the app named them (issue 135's fix, missed the
same way).

## Where it lives

- [surfaces/scheduling/booking-endings-copy.ts](../../../apps/workbench/surfaces/scheduling/booking-endings-copy.ts) (new) — both questions, once
- [surfaces/scheduling/booking-endings.tsx](../../../apps/workbench/surfaces/scheduling/booking-endings.tsx)
- [surfaces/scheduling/calendar-booking-modal.tsx](../../../apps/workbench/surfaces/scheduling/calendar-booking-modal.tsx)
- [surfaces/scheduling/calendar-booking-state.ts](../../../apps/workbench/surfaces/scheduling/calendar-booking-state.ts) (new)
- [surfaces/scheduling/calendar-booking-parts.tsx](../../../apps/workbench/surfaces/scheduling/calendar-booking-parts.tsx) (new)

## The fix

**The person is the title.** "Cancel Colette Mbeki's appointment?" — and where
nobody is recorded, "Cancel this appointment?", because a placeholder inside a
possessive ("Cancel No one assigned's appointment?") reads as a sentence written
by a machine.

**The body carries the appointment and the truth about who is told**, in the same
three branches the booking's own notices section uses:

| The booking has          | What the dialog says                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| a linked customer        | "Colette Mbeki is emailed to say it is off."                                                     |
| a written-down name only | "Tomas Herrera is not told: this booking has no account attached, so give them a ring yourself." |
| nobody at all            | "Nobody is told, because nobody is recorded on this booking."                                    |

The standing sentence on the pane takes the same branches, so the screen never
promises a message the dialog then withdraws.

**Both questions moved into one file**, read by the pane and by the diary's
modal. The modal now loads the booking's policy, so it says what happens to the
money like the pane does, and names who through the same ladder as the list and
the diary.

The modal was 507 lines and is now three files under the size rule: the shape,
the parts, and what it knows. Its Close button lost a `color="neutral"` nobody
had approved, and so did the business switcher on the way past.

## What the fix does not do

**It does not make a cancellation undoable.** The dialog is honest that it cannot
be, and the repair is a real one: the slot releases immediately and the same
booking can be taken again. What that costs is the customer's inbox — a
confirmation, a cancellation, and a second confirmation inside three minutes.
Whether an owner should get a short window to stop the message going out is a
product decision, not a repair, and it is not made here.

## Confirmed by

> Re-ran it as Nia on the booking I had just put back. **"Cancel Colette Mbeki's
> appointment?"** / "Cut and finish, Thu, Aug 27, 2026, 4:00 PM. This frees the
> slot for someone else. Colette Mbeki is emailed to say it is off. Nothing was
> paid up front, so no money changes hands. This cannot be undone." The line
> under the button on the pane says the same thing.
>
> Then the walk-in, on the pane: **"Cancel Tomas Herrera's appointment?"** /
> "Dry cut, Sat, Aug 22, 2026, 6:00 PM. This frees the slot for someone else.
> **Tomas Herrera is not told: this booking has no account attached, so give them
> a ring yourself.** Nothing was paid up front, so no money changes hands. This
> cannot be undone."
>
> Then the same booking from the diary — clicked its 6 PM block, and the
> quick-look modal now reads "Appointment · With Nia Okafor · **For Tomas
> Herrera**" where it used to name nobody, and its Cancel booking raises the
> identical dialog, word for word. Pressed Keep it every time; all three bookings
> are untouched.
