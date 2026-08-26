# 224 — The server explained the problem, and the screen said "check what you entered"

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 7
**Surface:** every write in mypiggles that can be refused for a business reason
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 7, on screen — "You can accept back at most 1, because that is what the customer asked to send"

## What happened

A refund would not go through ([223](223-writing-the-cheque-number-down-made-the-order-unrefundable.md)).
Twice. What Devi was told:

> **That didn't save.** Check what you entered and try again.

She had entered `42.00` in a box that had pre-filled itself with `42.00`. There
was nothing to check.

What the server had actually sent, in the same response:

> **No payment gateway is configured to settle this refund. Refund the customer
> manually or issue account credit.**

An explanation, a cause, and two things she could do about it — thrown away at
the door. The only way to read it was to open the network response by hand,
which is not a thing a shop owner does.

## What should have happened

When the server has written a sentence for a person, show that sentence.

## Why it matters

**"Check what you entered" is not merely unhelpful, it is wrong advice**, and
wrong advice is worse than none: it sends her back to re-type a figure that was
already correct, twice, and leaves her believing she caused it. Meanwhile the
real answer — _this shop has no card gateway; hand the money over or give store
credit_ — was sitting in the response.

This is not one screen. `apiErrorMessage` is the shared helper every write in the
console routes its failures through, so **every business rule the platform
enforces was reaching people as "check what you entered"**: an order that cannot
be cancelled once delivered, stock that cannot be reserved, a return approved for
more than was sent. Each of those has a hand-written sentence on the server, and
none of them arrived.

## Where it lives

[api-error.ts](../../../../piggles/apps/workbench/lib/api-error.ts):

```ts
if (error.code === 'VALIDATION_ERROR') return fallback;
```

The guard was written for a real problem and is correct about it: Zod's own
failure comes back as the fixed string _"Request validation failed."_, which
explains nothing and reads like the user's fault.

**But ONE code carries TWO senders.** The schema layer describing itself, and a
SERVICE deliberately explaining a business rule. Silencing the code silenced both
— the same shape as
[172](172-fourteen-of-her-fifteen-codes-were-not-the-one-she-typed.md), where one
outcome covered two causes with different fixes and the message sent the person
to redo what they had just done.

They are cleanly distinguishable and always were: **the schema layer attaches
per-field `details` and a service never does.**

## The fix

Silence the schema reporting on itself, not the code:

```ts
function schemaReportingOnItself(error: ApiError): boolean {
  if (error.code !== 'VALIDATION_ERROR') return false;
  if (Array.isArray(error.details) && error.details.length > 0) return true;
  return error.message === 'Request validation failed.';
}
```

Both branches are needed: `details` catches Zod and Fastify's own validator, and
the fixed string catches anything that sends the message without details.

**And one of those newly-visible sentences was written for a developer** — the
over-approval message named the return line's uuid. Now that these reach a
screen, they are read by a shop owner, so it reads _"You can accept back at most
1, because that is what the customer asked to send."_

## What it looked like once fixed

Devi typed `5` into **Accept back** on a return where one item was asked back:

> **Could not approve this return**
> **You can accept back at most 1, because that is what the customer asked to send.**

The old build would have said "check what you entered" — about a number she had
just entered on purpose.

## Left open

**Two toasts still fire for one failure.** The specific, correct one appears
alongside a generic _"That didn't save. Check what you entered and try again"_
from a global handler. The right message is present and readable, so this is
noise rather than a wrong answer, but a single failure should say one thing.
Recorded here rather than filed separately; it belongs to whoever owns the global
mutation handler.

## Rating effect

Not a single pane — it moves the floor under every write in the console.
Recorded in the run log of [03-juniper-row.md](../03-juniper-row.md).
