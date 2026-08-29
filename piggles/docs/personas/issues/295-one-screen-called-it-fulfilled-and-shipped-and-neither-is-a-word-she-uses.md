# 295 — One screen called it "Fulfilled" and "Shipped", and neither is the word she uses

**Status:** fixed
**Severity:** copy (a shopper-facing screen, in warehouse vocabulary, disagreeing
with itself)
**Found by:** P03 · Juniper Row · standing check "Buyer's side"
**Surface:** the tenant site — **Account › Orders** and **Account › Orders › Order**
**Filed:** 2026-08-27
**Fixed:** 2026-08-27
**Confirmed by:** The list, the badge and the timeline all read **On its way**

## What happened

On Anneliese's order page, the badge beside the heading reads:

> **Fulfilled**

Three inches below it, in the Order status card, the same event reads:

> **Shipped** — Aug 25, 2026, 4:59 PM

One screen, one fact, two words — and the word in the badge is the operator's.
"Fulfilled" is what Devi's console calls it because that is what the warehouse
step is named. It is not what a customer calls a parcel.

On the orders LIST the same badge renders the raw database value, lowercase and
untouched:

> `fulfilled`

So the platform shows a shopper three different renderings of one status across
two adjacent screens: `fulfilled`, `Fulfilled`, and `Shipped`.

## What should have happened

A shopper's order says what happened to her parcel in her own words, and says it
the same way everywhere: **Placed**, **Paid**, **On its way**, **Delivered**,
**Cancelled**, **Refunded**.

The audience rule is not ambiguous — user-facing copy assumes zero technical
vocabulary. A shopper on a small clothing label's website is about as far from
warehouse vocabulary as a reader gets.

## How to reproduce

Every time.

1. Sign in on Juniper Row's site as `anneliese.vogt@example.com`.
2. **Account › Orders** — the badge reads `fulfilled`, lowercase.
3. Open **#O-000004** — the badge reads `Fulfilled`, the timeline reads `Shipped`.

## Why it matters

It is copy, and it is scored as copy. But it is the copy on the screen a customer
opens when she is wondering where her parcel is, and it answers her in a word
about a warehouse process rather than about her parcel. The lowercase raw value on
the list is worse than jargon; it is visibly unfinished.

## Where it lives

- [wizeworks/apps/site/app/account/(authed)/orders/page.tsx](<../../../../wizeworks/apps/site/app/account/(authed)/orders/page.tsx>)
  — `<Badge …>{o.status}</Badge>`, the raw value.
- [wizeworks/apps/site/app/account/(authed)/orders/[orderId]/page.tsx](<../../../../wizeworks/apps/site/app/account/(authed)/orders/[orderId]/page.tsx>)
  — `<Badge …>{titleCase(order.status)}</Badge>`, the raw value title-cased.
- [wizeworks/apps/site/components/order-timeline.tsx](../../../../wizeworks/apps/site/components/order-timeline.tsx)
  — `label: 'Shipped'`, the only one of the three written for a reader.

Note the shape: `orderStatusTone()` already lives in `order-timeline.tsx` and is
shared by both screens precisely so the two "always agree" about color. The word
had no such function, so the two screens disagreed about the word.

## The fix

`orderStatusLabel()` joins `orderStatusTone()` in `order-timeline.tsx` — the two
screens now share the WORD as well as the color, for the same reason and in the
same place, so they cannot drift apart again:

| Stored      | Shown          |
| ----------- | -------------- |
| `placed`    | Placed         |
| `fulfilled` | **On its way** |
| `delivered` | Delivered      |
| `cancelled` | Cancelled      |
| `refunded`  | Refunded       |

The timeline's own step label moves from `Shipped` to `On its way` so the badge
and the step agree, and both order screens call the shared function. `titleCase`
is deleted from the detail page — it existed only to make a database value
presentable, which is the thing that was wrong.

## Confirmed by

**Account › Orders** now shows `On its way` where it read `fulfilled`, and the
order page's badge and its timeline step both read **On its way** — one word for
one fact on one screen.
