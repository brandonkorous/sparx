# 332 — Her customer card counted three orders and listed a different three

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · opening Marguerite Adeyemi's card to check [323] on screen
**Surface:** mypiggles › Customers › a customer › Overview
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** six integration tests against the real client, proved red then green, then the two cards read as Devi

## What happened

Marguerite's card, immediately after [323] landed:

| Their orders come to | Paid you so far | Orders |
| -------------------- | --------------- | ------ |
| $582.60              | $72.00          | 3      |

and directly beneath it, under **Recent orders**, three rows:

| Order    |           |         |
| -------- | --------- | ------- |
| O-000014 | To send   | $234.60 |
| O-000012 | To send   | $276.00 |
| O-000011 | Cancelled | $126.30 |

Three figures, three rows, and they are not the same three. The rows add to
$636.90 against a stated $582.60. Nothing on the card accounts for $72.00
collected, because every order shown reads as unpaid.

She has **four** orders. The figures leave the cancelled one out; the list did
not, and the list's three-row window then pushed off **O-000007**, the one order
she had actually paid for.

## What should have happened

The rows under a set of figures describe the orders those figures were computed
from.

## Why it happened

Two independent decisions that were each right on their own.

**The rollup counts non-cancelled orders**, and says why in its own header:
`COUNTED = { not: 'cancelled' }`, because "orders that never happened do not
count toward anything."

**The list asked for orders**, with no opinion about which:

```ts
const ordersQ = useOrders({ customerId: customer.id, sortBy: 'placedAt', order: 'desc', take: 3 });
```

Neither knew the other existed. On a customer with three or fewer orders and no
cancellation, they agree by accident, which is every customer this pane was built
against — including Anneliese Vogt, whose card in the same session was correct.

## Why it matters

**It is [323] one layer along.** That issue was a figure that agreed with
nothing on its card. This is a figure that agrees with nothing on its card. The
fix for 323 landed hours earlier and this was sitting directly underneath it,
which is the point worth keeping: fixing a number does not fix the screen the
number lives on.

**The failure is quiet in the worst way.** "Orders 3" over exactly three rows
reads as a complete list. A reader has no reason to doubt it, so they reconcile
the difference against themselves. And what went missing is not an incidental
row: it is the only order carrying money, on a shop that takes manual payment,
where "who still owes me" is the question the card exists to answer.

**A window looked identical to a whole.** `total` came back on every one of those
responses and nothing drew it, so three of eight and three of three rendered the
same. That is [[feedback_fetched_but_never_rendered]] again, third time this run.

## The fix

**One population.** `countedOnly` on the order list, resolved from the same
constant the rollup counts by:

```ts
// crm-schemas/src/orders.ts
export const UNCOUNTED_ORDER_STATUS: OrderStatus = 'cancelled';
```

The rollup builds `{ not: UNCOUNTED_ORDER_STATUS }` from it, the list builds the
same, and the customer card asks for `countedOnly: true`. Changing what counts
now moves both together, which is the only version of this fix that stays fixed.

An explicit `status` still wins over it. Asking for cancelled orders and getting
none would be the worse surprise, and `countedOnly` is for a list rendered beside
the figures, not a blanket hiding. The cancelled order remains on the Orders tab,
in the Related card, and in **Recent activity** on this same card, which is where
Marguerite's cancellation still reads today.

**Say when it is a window.** The section heading now states the count it is
showing out of: "Their 3 most recent. All 8 are on the Orders tab.", and
"Everything they have ordered." when the list is complete.

**Say what went back.** Found while confirming the above, and the same defect
again on the third axis — the figures are net of refunds and the amount column
was gross:

> Jo Kim. **Their orders come to $105.00**, one order listed, **$147.00**, badged
> "On the way".

$42.00 had been refunded on it. A FULL refund moves the status and gets a
"Refunded" badge to carry it; a PARTIAL refund moves nothing, so the row had no
way to say so. Every row with `refundTotal > 0` now carries the amount under the
total, in the pattern `order-detail-lines.tsx` already uses for a part-refunded
line. `refundTotal` was on the row object the whole time.

## Where it lives

- [orders.ts](../../../../wizeworks/packages/crm-schemas/src/orders.ts) — the shared constant + `countedOnly`
- [customer-rollup.ts](../../../../wizeworks/packages/crm/src/services/customer-rollup.ts) — reads the constant instead of its own literal
- [order-service.ts](../../../../wizeworks/packages/crm/src/services/order-service.ts) — applies it
- [orders.ts](../../../../wizeworks/services/api-rest/src/routes/v1/orders.ts) — `?counted_only=true`
- [order-queries.ts](../../../../piggles/apps/workbench/surfaces/commerce/order-queries.ts) — the console hook
- [customer-overview.tsx](../../../../piggles/apps/workbench/surfaces/crm/customer-overview.tsx) — asks for it, passes the total
- [customer-overview-lists.tsx](../../../../piggles/apps/workbench/surfaces/crm/customer-overview-lists.tsx) — the heading and the refund line

The Orders tab and the Related card were checked and deliberately left alone.
Neither sits under the figures and both are full lists, so a cancelled order
belongs in them.

## Confirmed by

`customer-card-agrees.test.ts`, six tests against a real database, rebuilding
Marguerite's exact shape. The load-bearing one does not check that 3 equals 3 —
it reads the count off the card and the rows off the list and asserts they came
from the same orders:

```ts
expect(total).toBe(card.orderCount);
const worth = items.reduce((s, o) => s + Number(o.total) - Number(o.refundTotal), 0);
expect(worth.toFixed(2)).toBe(Number(card.totalOrdered).toFixed(2));
```

Removing the guard fails four of the six. Restored, all six pass, and so do
`@wizeworks/crm` (483 across 51 files) and `api-rest` (428 across 75).

Then on screen as Devi: Marguerite reads $234.60 + $276.00 + $72.00 **Collected**
= $582.60 against a stated $582.60, Anneliese reads $180.00 + $152.00 + ($170.00
less $170.00 refunded) = $332.00 against $332.00, and Jo Kim reads $147.00 less
$42.00 refunded = $105.00 against $105.00.

## Also found, not fixed

**"Refunded" is a grey badge.** `order-tone.ts` returns `neutral` for refunded
and voided states across four helpers — a systematic house choice meaning "this
state is inert", not an oversight, and its `Tone` union has only five members
with the other four already spoken for by live states in the same column. It is
still a neutral status badge, which the design rules do not allow without
Brandon's say-so, and picking its replacement means widening that union. That is
a design decision across the whole Selling surface rather than part of this
issue, so it is raised rather than taken.

Noted alongside it: `shippingState` calls a cancelled order `danger` and
`fulfillmentTone` calls a cancelled fulfillment `neutral`, in the same file.

## Rating effect

Against `Customers › a customer`. The pane's figures were right and its card was
not, which is the distinction [323] was already about.
