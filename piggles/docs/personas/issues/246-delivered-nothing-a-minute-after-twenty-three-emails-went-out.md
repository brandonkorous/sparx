# 246 — "Delivered 0" a minute after twenty-three emails went out

**Status:** fixed and confirmed
**Severity:** high
**Found by:** P03 · Juniper Row · act 10 — reading the results of the autumn drop
**Surface:** mypiggles › Messages › Broadcasts › one sent broadcast
**Filed:** 2026-08-26
**Fixed:** 2026-08-26
**Confirmed by:** P03 · Juniper Row · act 10 — the same broadcast now reads "Delivered 23 · On their way"

## What happened

Devi sent her newsletter to 23 people. It worked: 23 rows queued, 23 dispatched,
23 `accepted` events written by the mail provider. She scrolled down to see how
it did:

```
Delivered        0
Opened           0    0% of delivered
Clicked          0    0% of delivered
Bounced          0    Couldn't be delivered
```

## What should have happened

Twenty-three emails had gone out. The screen should say so.

## Why it matters

This is the only screen in the product that reports whether an email campaign
worked, and one minute after a successful send it said nothing had been
delivered to anybody. The obvious reading is total failure — and the natural
next move is to send it again, to the same 23 people.

A delivery is CONFIRMED by the receiving mail server minutes to hours after a
send. `delivered: 0` therefore has two completely different meanings — "nothing
went out" and "nothing has been confirmed yet" — and the tile rendered both as
the same zero. That is the platform's own rule about never presenting absence as
measurement, broken on the surface where the measurement is the entire point.

The percentages made it worse. "0% of delivered" divides by a delivered count
that is zero, and reads as an engagement rate rather than as an unanswered
question.

## Where it lives

The count was right there and unused. `stats.accepted` is a first-class field on
`BroadcastStats` — `analytics-service` returns it, and `email-worker` writes an
`accepted` row on every successful send precisely so this number exists without
waiting for a webhook. The grid's own percentage base already knew to fall back
through it:

```ts
const base = stats.delivered || stats.accepted || recipients || 0;
```

The **Delivered tile itself** printed raw `stats.delivered`. So the file already
held the correct answer, used it for the denominator, and did not use it for the
number the owner actually reads. This is the commonest defect shape in this
codebase: a value already in the component's hand that nothing draws.

In dev this never self-corrects — the console provider emits `accepted` and no
webhooks at all, so `delivered` stays 0 for ever and the screen claims permanent
failure for a send that worked.

## The fix

The Delivered tile has three states, because there are three:

| Situation                       | Number    | Sentence under it                                             |
| ------------------------------- | --------- | ------------------------------------------------------------- |
| Confirmations have arrived      | delivered | Confirmed by the receiving mail server                        |
| Handed over, none confirmed yet | accepted  | On their way. Confirmations arrive over the next few minutes. |
| Nothing sent                    | 0         | Nothing has gone out yet                                      |

And the share label follows the same honesty: `of delivered` only while
something is confirmed delivered, otherwise `of those sent`.

## What it looked like once fixed

```
Delivered       23    On their way. Confirmations arrive over the next few minutes.
Opened           0    0% of those sent
Clicked          0    0% of those sent
```

## Related

The same act's [245](245-three-answers-to-who-the-email-came-from.md) is the
other half of a sent broadcast reporting something untrue about itself.

## Rating effect

`Messages › Broadcasts` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
