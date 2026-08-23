# 158 — Typing the date put a red error across her booking page

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · standing check "without a mouse"
**Surface:** haloandhem.com › Book › Cut and finish
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** the same keystrokes, re-run — below

## What happened

Booking an appointment with the keyboard only. Tabbed to the Date field and typed
the date the way you type a date — `08272026`. The times for the 27th loaded
correctly, and above the Book button a red banner appeared:

> **Request validation failed.**

It did not go away. It sat there while I picked a time, while I typed my name, my
email and my phone number, and it was still there when I tabbed onto the button —
a red error box between a customer and the thing she came to press.

Nobody using a mouse has ever seen it. The date picker only ever hands over a
whole date; only typing produces this.

## Why it matters

Two things, and the second is the worse one.

The **words** are ours, not hers. "Request validation failed." is a sentence about
a schema. A woman booking a haircut cannot act on it, cannot tell whether her
booking is in danger, and cannot tell whether it is her fault. This is the same
defect family as [124] and [146] — an engine's own message handed to a customer
verbatim.

The **timing** is worse. The error is about a request that was already superseded
by a successful one. So the page is showing a failure that did not happen, about a
date she is no longer looking at, above a button that works fine. Everything is
actually correct except the one red thing on screen.

## How to reproduce

Every time.

1. Open `localhost:3004/book` and choose **Cut and finish**.
2. Tab to the **Date** field — do not click it, do not use the picker.
3. Type `08272026`.
4. The times for 27 Aug load, and the red banner appears above the button.

## Where it lives

`<input type="date">` reports its value on **every segment edit**, so typing the
year emits four values on the way to one date:

| value sent   | request               | result |
| ------------ | --------------------- | ------ |
| `0002-08-25` | `from=-003795-08-25…` | 422    |
| `0020-08-26` | `from=-003741-08-26…` | 422    |
| `0202-08-25` | `from=0202-08-25…`    | 200    |
| `2026-08-25` | `from=2026-08-25…`    | 200    |

Read from the network panel during the run. Year 2 and year 20 are real years, so
`Date.parse` accepts them; the zone arithmetic in `startOfDay` then turns their
pre-1900 local-mean-time offsets into a negative year, which is what the API
rejects. Year 202 sailed through with a 200 — the availability endpoint was asked
about a Tuesday in the third century and answered.

The banner outlived the correct answer because `fetchSlots` clears the error on
entry, and the two doomed requests resolved after the good one did.

- [wizeworks/apps/site/components/booking/booking-widget.tsx](../../../../wizeworks/apps/site/components/booking/booking-widget.tsx) — `fetchSlots`
- [wizeworks/apps/site/components/booking/booking-clock.ts](../../../../wizeworks/apps/site/components/booking/booking-clock.ts) — the day helpers
- [wizeworks/apps/site/lib/scheduling-client.ts](../../../../wizeworks/apps/site/lib/scheduling-client.ts) — `unwrap`

## The fix

**A half-typed date is not a date.** New `isBookableDay(day, tz)` in
`booking-clock.ts`, beside the other day helpers, asserting exactly what the input's
own `min` already claims: four digits, parseable, and not before today where the
business is. `fetchSlots` returns early when it fails, so the page shows nothing
and asks nothing while she is still typing. Six requests became three.

**A schema rejection is never a sentence for a customer.** `unwrap` now reads the
envelope's `code`. Everything except `VALIDATION_ERROR` still passes through word
for word, because the scheduling engine's refusals are the salon's own answer and
making them vaguer helps nobody — "we're closed that week", "nobody is working
then" ([149], [150]). `VALIDATION_ERROR` and a bare non-2xx both become "Something
went wrong at our end. Please try again in a moment." The old fallback for a
non-2xx was `Request failed (500)`, which had the same problem.

Both halves were needed. The guard stops it happening on the booking page; the
`unwrap` change means the next surface to send a malformed request does not print
schema-speak at whoever is standing in front of it.

## Confirmed by

Re-ran the check as the customer, keyboard only, same field, same keystrokes
`08272026`: the times for 27 Aug loaded (9:00 AM and 11:00 AM) and **no banner
appeared**. The network shows three requests, all 200, all with a four-digit year —
the two 422s and the year-202 lookup are gone.

The whole booking also completed keyboard-only in the same run, which is the
standing check itself: Tab to a service card → Enter → Tab through Any
available / Dara Bell / **Nia Okafor** → Enter → date → time → the four fields →
Enter on **Book 10:45 AM**:

> **You're booked.** Cut and finish with Nia Okafor is confirmed for Tuesday,
> August 25 at 10:45 AM. A confirmation is on its way to yusuf.adeyemi@example.test.

Independently visible on screen: the 25th's slot list afterwards is missing 10:00
through 11:30 — a one-hour booking at 10:45 blocking backwards — so the record
really is in Nia's diary.

## Rating effect

`P02 — book an appointment (keyboard)` — recorded in [rating.md](../rating.md).
