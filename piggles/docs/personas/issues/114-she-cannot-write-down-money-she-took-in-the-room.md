# 114 — She cannot write down money she took in the room

**Status:** fixed
**Severity:** blocker
**Found by:** P02 · Halo & Hem · act 8
**Surface:** mypiggles › Sell › Orders
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below
**Blocked on:** —

## What happened

Nia finished a bond repair on Priyanka in the chair and wanted to take $45 for
it. She typed **"take a payment"** into the box that says _What do you want to
do?_ and got **"Nothing matches that. Try a different word."** (a separate
defect — [120](120-the-search-only-finds-you-what-you-already-know-the-name-of.md)).
So she went to Sell › Orders, which said:

> **No orders yet** — When someone buys from you, the order shows up here with
> what they bought and what they owe.

There was no button on it. No "new order", no "record a sale", nothing. The
global **+** offers "A product", "An invoice", "A customer" and no sale. Money ›
Payments is read-only. Searching "sale" returns five wholesale screens.

The registry said so out loud:

> Reachable from the list, not the launcher … There is no create counterpart
> either: **orders are placed by customers, or by checkout on their behalf.**

That is true of a shop. Halo & Hem is a salon: nearly all of its money is handed
over in the room, by people who never touch the website. `POST /v1/orders` has
existed the whole time, with `channel: 'admin'` in its enum for exactly this, and
free-text line items that need no catalog entry. Nothing called it.

## What should have happened

She should be able to write down a sale she just made. This is not a nicety for
this audience — a salon, a bakery, a garage, a therapist and a trainer all take
most of their money face to face, and Piggles' own copy already promises it: the
Payments empty state says money shows up there when a customer pays "on your
website, a marketplace, **or in person**".

## How to reproduce

1. Sign in as p02.nia@piggles.test, open Sell › Orders.
2. Try to record a $45 treatment paid for in cash. Every time: there is no path.

## Why it matters

Wrong money, and all of it. The takings of the business simply did not exist in
the product. She could book the appointment, mark it complete, and be left with
no record of the $45 — which is what act 7 already showed: completing Yusuf's cut
produced no order and no money anywhere.

## Where it lives

- [surfaces/commerce/orders-list.tsx](../../../apps/workbench/surfaces/commerce/orders-list.tsx)
- [lib/surfaces/catalog/commerce-orders.ts](../../../apps/workbench/lib/surfaces/catalog/commerce-orders.ts)
- `POST /v1/orders` — [routes/v1/orders.ts](../../../../wizeworks/services/api-rest/src/routes/v1/orders.ts)

## The fix

A new surface, **Take a sale** (`commerce.sale.new`), reachable from the Orders
toolbar, from the Orders empty state, from the `+` beside Orders in the nav, and
from the launcher under _till, counter, cash, card, in person, walk-in_.

- [surfaces/commerce/sale-detail.tsx](../../../apps/workbench/surfaces/commerce/sale-detail.tsx) — who it was for, what they had, what they paid.
- [surfaces/commerce/sale-lines.tsx](../../../apps/workbench/surfaces/commerce/sale-lines.tsx) — one list to pick from, plus **Write something in** for a one-off.
- [surfaces/commerce/sale-payment.tsx](../../../apps/workbench/surfaces/commerce/sale-payment.tsx) — prefilled with the total, clearable for an unpaid slip.
- [surfaces/commerce/sale-data.ts](../../../apps/workbench/surfaces/commerce/sale-data.ts) — the order, the money, and the handover.

Two decisions worth naming. **Her diary services and her products are one list**,
because she does not think "catalog" and "diary" — she thinks a bottle of shampoo
and a bond-repair treatment, and both go on the same receipt. And **a one-off
needs no catalog entry**: `LineItemInput.productId` was already optional, so
"Bond repair treatment, $45" is a legal line with nothing set up in advance.

Three related defects came out of building it and are filed separately:
[116](116-a-sale-taken-at-the-counter-waits-forever-to-be-sent-to-a-warehouse.md)
(the sale never closed), [117](117-the-money-she-took-over-the-counter-never-reached-her-money-screens.md)
(it never reached Money), [118](118-there-was-no-way-to-say-a-card-was-taken-on-her-own-machine.md)
(no way to say "card").

## Confirmed by

> Re-ran P02 act 8 as Nia. Sell › Orders now leads with **Take a sale**. Sold
> Priyanka a written-in "Bond repair treatment" at $45 on card, then a
> "Bond repair take-home kit" at $22, then picked "Dry cut" off her own list for
> Rob Alvarez at $40 cash. All three wrote real orders (O-000001 … O-000003),
> each showing **Paid**, the right total and the right buyer, and the third
> reads **Paid · Collected** with nothing outstanding.

## Rating effect

`Sell › Orders — Completeness 3 → 9`. Recorded in [rating.md](../rating.md).
