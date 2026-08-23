# 105 — A client booked her most expensive appointment and was told it had failed

**Status:** fixed
**Severity:** blocker
**Found by:** P02 · Halo & Hem · act 6
**Surface:** the published site — `/book/<service>` for any service with a deposit
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** a client · on the live site 2026-08-22

## What happened

Priyanka opened Halo & Hem's booking page, picked **Full head highlights** — two
and a half hours, $180, the salon's biggest appointment — chose Friday 28 August
at 9:00 AM, typed her name, her email and a note about her ammonia allergy, and
pressed **Book 9:00 AM**.

The form said:

> **An internal error occurred.**

Nothing else. No booking reference, no explanation, no suggestion.

**Her appointment exists.** Read straight out of the database, thirty seconds
later:

```
460c5efc-70f5-4fe6-8d39-65cfadd4f79f | confirmed | 2026-08-28 16:00:00+00
notes: Allergic to ammonia - please use the ammonia-free line as usual.
Priyanka Deshmukh | priyanka.d@example.test
deposit_status: (null)
```

Confirmed. In Nia's diary. With the allergy note attached. And the woman who made
it has been told it failed.

## Why this is a blocker

Every outcome from here is bad, and each is worse for a different person:

- **Priyanka** books somewhere else, or rings — which is the exact thing Nia bought
  this software to stop.
- **Nia** holds a two-and-a-half hour block on a Friday morning for somebody who
  believes she has no appointment. That is most of a morning, and she will not know
  until nobody turns up.
- **Nobody is told.** The booking is `confirmed`, so it appears normal in the
  console. Only the customer saw the error, and only the server log has the reason.

It also silently drops the money: `deposit_status` is null, so the **$25 deposit
was never taken** on a service Nia set a deposit on, and her booking page promises
one. She is protected by a rule that did not run.

## How to reproduce

Every time, on any tenant provisioned normally, for any service with a deposit
policy.

1. Published site › a service whose booking rule sets a deposit.
2. Pick a time, fill in name and email, submit.
3. "An internal error occurred." — and the booking is in the database.

## Where it lives

Three things line up, and any one of them would have stopped it.

**1. Every new tenant is provisioned onto a gateway that is not a gateway.**
`tenant_payment_configs` for this salon, written at sign-up:

```
gateway_id: manual   is_active: true   onboarded_at: 2026-08-21T22:24:47Z
```

`manual` is a real entry in the payments catalog — "No online processing — record
payments by hand". It is deliberately **not** in `gatewayRegistry`, because there
is no adapter to register: it is the absence of online payments, expressed as a
choice.

**2. So resolving it throws the wrong kind of error.**
`PaymentService.getGatewayForTenant` finds the config row, and hands its id to
`gatewayRegistry.get('manual')`, which throws `GatewayNotFoundError` — not the
`PaymentConfigError` that means "this tenant takes no online payments".

**3. And the deposit step only forgives the other one.**
[wizeworks/services/api-rest/src/lib/scheduling-payments.ts](../../../../wizeworks/services/api-rest/src/lib/scheduling-payments.ts):

```ts
} catch (err) {
  if (err instanceof PaymentConfigError) {
    logger.warn(…, 'deposit policy set but no payment gateway configured — skipping deposit');
    return { required: false };
  }
  throw err;
}
```

A tenant with **no** gateway is handled gracefully. A tenant with the **manual**
gateway — which is every tenant on day one — throws.

**4. And the throw happens after the booking is committed.**
[…/routes/v1/public/scheduling.ts](../../../../wizeworks/services/api-rest/src/routes/v1/public/scheduling.ts):

```ts
const created = await createBooking({ … });        // committed
const deposit = await createBookingDeposit(…);      // throws → 500
```

The line four below it gets this exactly right, and says so:

```ts
// Best-effort: never blocks the booking response.
await sendOwnerBookingNotification(request.log, tenantId, created.booking.id);
```

The deposit was not given the same protection, understandably — a deposit is
load-bearing where a notification is not. But the failure mode chosen is the worst
of the three available: the booking is made, the money is not taken, and the
customer is told the whole thing failed.

## The fix

Two changes, because these are two defects that happened to fire together.

**1. "Manual" means no online payment, not a broken gateway.** `createBookingDeposit`
treats `GatewayNotFoundError` the way it already treats `PaymentConfigError` — log
it, take no deposit, let the booking stand. A business recording payments by hand
takes its deposit at the chair.

**2. A booking that exists is never reported as a failure.** The deposit call is
wrapped, so any failure inside it leaves the customer with their confirmation
rather than an error, and leaves the reason in the log for the owner's support
request.

## Confirmed by

Re-run on the live site 2026-08-22, as a client booking **Restyle, long hair** —
the other service Nia put a $25 deposit on — for Saturday 29 August at 11:00 with
Nia:

> **You're booked** — Restyle, long hair is confirmed for Saturday, August 29 at
> 11:00 AM. A confirmation is on its way to ekaterina.v@example.test.

No error. The row is `confirmed`, assigned to Nia Okafor, with the customer's note
attached and `deposit_status` empty — which is the true state for a business that
takes no online payments, and is now reached quietly instead of by a 500.

## What is still open after the fix

**Nobody tells Nia her deposit is not being taken.** Her Booking rules pane says
"Color deposit · $25 · 48 hours", her booking page tells clients a deposit holds
their place, and neither is true until she connects a card processor. That is
[[feedback_never_present_absence_as_measurement]] on the owner's side and wants
its own answer — a line on the booking rule, or on the service, saying "no deposit
can be taken until you connect a way to get paid". Recorded here rather than
fixed, because the right place for that sentence is a product decision.

## Rating effect

The published booking page is scored in [rating.md](../rating.md).
