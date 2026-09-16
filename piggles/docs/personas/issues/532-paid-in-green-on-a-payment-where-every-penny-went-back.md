# 532 — "Paid", in green, on a payment where every penny went back

**Status:** fixed and proven
**Severity:** major
**Found by:** Devi, reading Money → Payments
**Surface:** `surfaces/finance/format.ts` + `payments-list.tsx` (both consoles), `api-rest/src/lib/payment-filter.ts` (new)
**Filed:** 2026-09-15
**Follows:** [522](522-her-overdue-list-was-empty-while-she-was-owed-986-dollars.md), [530](530-what-needs-you-said-nothing-needed-her.md)

## What she saw

Money → Payments. Two rows down:

> |             |                              |          |                              |
> | ----------- | ---------------------------- | -------- | ---------------------------- |
> | 21 days ago | Anneliese Vogt<br>`O-000004` | **Paid** | **$170.00**<br>−$170.00 back |

The badge and the line under it are three pixels apart and disagree with each
other. She was paid $170 and gave back $170. The row says **Paid**, in the color
of good news.

Then she picked **Refunded** from the status filter to see what had gone back.
**Nothing.** Zero of zero, on a shop with $212 of refunds.

## Why

The same defect she has now found four times, in its fifth place: **a stored
status word that something in another table has made stale.**

A refund is a row in `order_refunds`. `recordRefund` writes that row, flips the
ORDER's status, and recomputes the ORDER's payment rollup. It never touches
`order_payments.status`, which goes on saying `captured` for ever.

```ts
export function paymentState(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'captured':
      return { label: 'Paid', tone: 'success' };
    ...
    case 'refunded':
      return { label: 'Refunded', tone: 'warning' };   // unreachable
```

Measured platform-wide: **four payments have refunds against their order, and
three still say `captured`.** The fourth says `refunded` only because a seed
wrote the word directly. No product path writes it, so that `case` had never
run for a real refund.

## What makes this one avoidable rather than merely wrong

**The numbers were already in the caller's hand.** `payments-list.tsx` renders
`payment.refundedAmount` two lines under the badge — that is where the
"−$170.00 back" comes from. The row had the truth and the badge was not looking
at it. This is [[feedback_fetched_but_never_rendered]] in its sharpest form:
not a value nobody drew, but a value drawn right next to a contradiction of it.

The order-level screens were fine the whole time, which is what pinned the
diagnosis: `commerce/order-tone.ts`'s `paymentState(order)` reads
`order.paymentStatus`, and that IS maintained by `recomputeOrderPaymentRollup`.
The rollup updates the order and skips the payment.

## What changed

**1. The badge takes the money, not just the word.**

```ts
export function paymentState(status, refunded, amount) {
  if (refunded > 0 && (status === 'captured' || status === 'refunded')) {
    return refunded >= amount
      ? { label: 'Refunded', tone: 'warning' }
      : { label: 'Part refunded', tone: 'warning' };
  }
  ...
```

`refunded` and `amount` are **required, not defaulted**, so a new caller has to
decide rather than silently inherit the old blindness.

`>=` really is "all of it": api-rest caps each payment's apportioned share at
its own amount, so the share can never exceed what came in.

**2. The Refunded filter asks the money.**

`status=refunded` now means "payments on an order with money back", not
"payments carrying a word nothing writes". The order's `refundTotal` is the
reliable question — it is maintained at a documented chokepoint and agrees with
the refund rows on all **11** refunded orders here.

The status is widened to `captured` **or** `refunded` rather than dropped: a
refund only ever comes off money that was taken, and leaving it open would put a
`pending` or `failed` row on a screen about money that moved.

**3. The status rides along in a saved view.** The pane's `views` params carried
only `q` and `sort`, so saving "Failed payments" and re-opening it gave you every
payment. Same family as [529](529-eight-seeded-views-pointed-at-screens-that-do-not-exist.md).

## Why there is a new api-rest file

The filter decision lived inside a Fastify handler, where nothing can reach it.
It is now `src/lib/payment-filter.ts` — the same move as `home-counts.ts`,
`today.ts` and `broadcast-stats-words.ts`, for the same reason: **a filter is
exactly the part a type cannot check.** Every value in one is a string handed to
a query. They all compile.

## Proven

Ten guards, and every break reddens at least one:

```
RED   B1 the shipped bug: badge ignores the money        ->  2 failed | 4 passed (6)
RED   B2 whole and part refund collapse into one word    ->  1 failed | 5 passed (6)
RED   B3 the money overwrites words it must not touch    ->  4 failed | 2 passed (6)
RED   B4 a stored `refunded` word falls through to raw   ->  1 failed | 5 passed (6)
RED   B5 colored success anyway                          ->  1 failed | 5 passed (6)

RED   C1 the shipped bug: refunded stays a status word   ->  1 failed | 3 passed (4)
RED   C2 order condition without narrowing the status    ->  2 failed | 2 passed (4)
RED   C3 money condition dropped, status widened only    ->  1 failed | 3 passed (4)
RED   C4 "all" leaks a literal status                    ->  1 failed | 3 passed (4)
RED   C5 every filter drags in the money condition       ->  1 failed | 3 passed (4)
```

B3 is the interesting one: widening the money rule to `refunded >= 0` reddens
four guards, because it would badge a **failed** payment "Refunded". A fix that
overreaches is a worse lie than the one being fixed.

## Proven on her screen

```
21 days ago   Jo Kim           [Part refunded]   $147.00
              O-000005                            −$42.00 back

21 days ago   Anneliese Vogt   [Refunded]        $170.00
              O-000004                           −$170.00 back
```

And the filter, which returned nothing at all this morning:

```
Status: Refunded     Showing 1–2 of 2
```

## Two things measured and left alone

**The refund reason on `O-000004` is a raw id** — `Return c2533620-bafb-4fca-…`
sitting in a field a person reads. It is **old data**, not live behavior: the
shipped `issueRefund` writes `'Sent back by the customer'` or `'Sent back: …'`,
and there is no string like it anywhere in the tree. Left as it is.

**Eight orders have refunds and no captured payment at all**, so their refunds
never appear on this screen. Seven are seeded B2B sales orders (`SO-91001`) with
no payment rows whatsoever, on other tenants; the eighth is the seed's one
`refunded` payment. Nothing a person did produced them, and nothing on a screen
could act on them.
