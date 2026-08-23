# 143 — Turning off "tell the customer" on a cancellation still told them

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · standing check — wrong moves (while fixing 142)
**Surface:** api-rest › `POST /v1/scheduling/bookings/:id/cancel`
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

`CancelBookingInput` has carried this since the route shipped:

```ts
notifyCustomer: z.boolean().default(true),
```

It is parsed, defaulted, validated, and then **never read**. `cancelBooking`
calls `cancelBookingNotifications` unconditionally, so a caller that passes
`notifyCustomer: false` gets the cancellation email sent anyway.

Nothing in the console offers that switch today, so no Piggles owner has been
bitten by it. But it is a documented field on a public write endpoint that does
the opposite of what it says, and the whole reason it exists is the case where
saying it again is wrong: you have already rung the customer, they know, and a
"your appointment is cancelled" email arriving afterwards reads as a second
cancellation.

## Why it matters more than it looks

This is the "absent behaves like fine" shape at the API layer. A field that is
accepted and ignored is indistinguishable, from the caller's side, from a field
that works — the request returns 200 either way. Nothing fails, nothing logs, and
the only evidence is in the customer's inbox.

## Where it lives

- [packages/scheduling/src/booking-service.ts](../../../../wizeworks/packages/scheduling/src/booking-service.ts) — `cancelBooking`
- [packages/scheduling-schemas/src/bookings.ts](../../../../wizeworks/packages/scheduling-schemas/src/bookings.ts) — `CancelBookingInput`

## The fix

`cancelBooking` reads the flag. When it is true, nothing changes. When it is
false, the pending reminders are still dropped — a cancelled booking must never
remind anyone — but no cancellation notice is enqueued:

```ts
if (input.notifyCustomer) await cancelBookingNotifications(tx, tenantId, updated);
else await dropPendingBookingNotifications(tx, updated.id);
```

The console keeps passing `true` explicitly rather than leaning on the default,
so the dialog's promise and the behaviour are stated in the same place.

## What this is not

**It is not a new control.** Whether an owner should be offered "do not tell
them" on the cancel dialog is a product decision and is not made here; issue 142
records the related question of a window to stop a message already on its way.
This only makes the existing contract true.

## Confirmed by

> 116 scheduling tests pass. The change is on the write path with no UI that can
> reach the false branch yet, so it is verified by reading the two helpers rather
> than from a screen: `cancelBookingNotifications` does `cancelPending` and then
> `enqueueRows`, and `dropPendingBookingNotifications` is exactly its first half,
> so the else branch keeps the reminder-clearing and drops only the notice.
> Cancelling Colette's booking through the pane still queued and sent her
> cancellation email — `scheduling_booking_notifications` shows one
> `cancellation / email / sent` row — so the true path is unchanged.
