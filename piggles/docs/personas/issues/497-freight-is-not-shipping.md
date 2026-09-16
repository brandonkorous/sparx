# 497 — Freight is not shipping, and calling both of them shipping cost her $25

**Status:** fixed, and driven on screen end to end
**Severity:** major
**Found by:** Brandon, on [496](496-the-25-dollars-of-carriage-she-typed-never-reached-what-the-linen-cost.md)
**Surface:** the purchasing spine, both consoles + `@wizeworks/inventory` + the schema
**Filed:** 2026-09-09

## The distinction

> **Freight** is for inbound transportation cost, and **shipping** is for the
> outbound transportation cost. — Brandon

That is the standard accounting split and it is load-bearing:

- **FREIGHT** — supplier to you. Part of what the stock cost. It belongs in the
  value of what you hold, so it flows into margin when the item sells.
- **SHIPPING** — you to a customer. A selling expense. It never touches stock
  value.

## Both were called shipping, in the same database

```
commerce_carts.shipping_total_cents              outbound  (correct)
commerce_checkout_sessions.shipping_total_cents  outbound  (correct)
inventory_purchase_orders.shipping_cents         INBOUND   (wrong word)
inventory_supplier_bills.shipping_cents          INBOUND   (wrong word)
```

**The wrong word is why the inbound one behaved like the outbound one.** Named
after a thing that is only ever a line on a total, it was only ever a line on a
total: `shippingCents` was read by `recomputeTotals` and by the printed order,
and by nothing in the receiving path at all. So a dressmaker typed $25 of
carriage on a $720 order, paid $745, and the 38 metres that arrived were valued
at $684 ([496](496-the-25-dollars-of-carriage-she-typed-never-reached-what-the-linen-cost.md)).

There were **three** user-facing words for it as well, which is the same
confusion wearing different clothes:

| screen                   | it said         |
| ------------------------ | --------------- |
| Purchase order           | Shipping cost   |
| Supplier bill            | Carriage        |
| The receipt's bill panel | Delivery charge |

All three are **Freight** now.

## What changed

**Schema + migration** (`20270503000000_freight_is_not_shipping`):

```sql
ALTER TABLE "inventory_purchase_orders" RENAME COLUMN "shipping_cents" TO "freight_cents";
ALTER TABLE "inventory_supplier_bills"  RENAME COLUMN "shipping_cents" TO "freight_cents";

ALTER TABLE "inventory_purchase_order_charges"
  ADD COLUMN "is_order_freight" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "inventory_po_charges_one_order_freight"
  ON "inventory_purchase_order_charges" ("purchase_order_id") WHERE "is_order_freight";
```

**Freight now reaches the cost.** Not by a new mechanism — `PurchaseOrderCharge`
already spreads a cost across the deliveries on an order, tracks
`allocated_cents` so four part-shipments cannot each claim the whole of it, and
its `kind` vocabulary already **began with `freight`**. The order's freight
becomes one of those charges. `recomputeTotals` — which already owned "the
order's money is consistent" — now keeps it in step:

```ts
if (po) await syncOrderFreightCharge(tx, po.tenantId, purchaseOrderId, freight);
```

Three rules in that function, each for a reason:

- `isOrderFreight` marks the one charge it owns. A freight charge somebody added
  themselves is untouched — the supplier's carriage line and the forwarder's own
  invoice are different facts, and a person who recorded both meant both.
- Clearing the freight **does not** claw back what a posted delivery already
  took. The row is deleted only if it never reached anything; otherwise it is
  trimmed to what was already apportioned.
- Raising it is never allowed below `allocatedCents`, or the running total
  apportioned would exceed the charge it came from.

**It DOES reach deliveries already posted, and that was wrong in this document
until the screen corrected it.** `syncOrderFreightCharge` itself re-costs
nothing. But posting a delivery calls `reallocateOrderCharges`, which zeroes
every charge on the order and replays all of its deliveries in the order they
arrived. So the first 38 metres picked up their $23.75 the moment the last 2
were booked in, and all forty settled at $18.63.

That is right, and the alternative is the bug. Without the replay those 38
metres would have sat at $18.00 forever and $23.75 of freight would simply have
evaporated, which is [496](496-the-25-dollars-of-carriage-she-typed-never-reached-what-the-linen-cost.md)
again for the bulk of the order. What is NOT rewritten is a sale: the replay
moves the value of what is still on hand, and units already sold were sold at
the cost recorded at the time.

**The rename is an allowlist, not a sweep.** 134 replacements across 23 named
files. `commerce-schemas/src/surcharge.ts` and `commerce/src/services/checkout-service.ts`
were left alone on purpose — their `shippingCents` is fed from a cart's
`shippingTotalCents` and is correctly outbound. Renaming those would be the same
mistake in the other direction.

**Copy rewritten to match the new behavior**, in the same breath. An hour before
this, 496's fix put a sentence on the Shipping cost field saying it is _not_
spread into what each item cost. That is now false, so it went:

> What it costs to get these goods to you. It is spread across the items as they
> arrive, so what you hold is valued at what it really cost.

## Green

- All **ten** structural checks, `check:migration-order` included.
- eslint clean on both consoles' inventory surfaces and on the inventory package
  apart from the stale-client errors below.
- prettier applied.

## Applied 2026-09-09, and the numbers check out

Brandon ran it. `20270503000000_freight_is_not_shipping` is applied, the client
is regenerated, and the four typecheck errors and one eslint error it was
carrying are gone.

```
inventory_purchase_orders.freight_cents        integer  not null  default 0
inventory_supplier_bills.freight_cents         integer  not null  default 0
inventory_purchase_order_charges.is_order_freight  boolean  not null  default false
  "inventory_po_charges_one_order_freight" UNIQUE btree (purchase_order_id) WHERE is_order_freight
```

**1,329 tests pass** — 360 in `@wizeworks/inventory` (including the DB-backed
integration suites, since docker was up), 459 in `commerce-schemas`, 510 in
api-rest.

## The orders that already existed needed their own migration

Applying the rename left a gap nobody would have seen. `recomputeTotals` creates
the freight charge, and it only runs when an order is edited — so every order
raised BEFORE this had its freight sitting in `freight_cents` with no charge
behind it. **Nine of them**, six of those `partial`: a delivery already posted
and more still to come.

Leaving that is not neutral, and the obvious fix is worse than leaving it:

- With **no charge**, the rest of the goods land carrying no freight at all —
  which is defect 496 all over again, for the deliveries that have not happened
  yet.
- With a charge created at **`allocated_cents = 0`**, the final delivery on an
  order is the one that sweeps up everything unallocated. Two metres of linen
  would swallow the whole $25 that belonged to forty, and land on the shelf at
  $30.50 a metre.

So `20270504000000_backfill_order_freight_charges` creates each charge with the
share the already-posted deliveries would have taken, marked as spent. Its
arithmetic mirrors `resolveCharges` line for line: a delivery's share is its
goods value over the **order's** value, not over what remains.

Devi's order came out exactly on the number this issue predicted:

| order     | status  | charge | already spent | left for what is still to come |
| --------- | ------- | ------ | ------------- | ------------------------------ |
| PO-000001 | partial | $25.00 | **$23.75**    | **$1.25**                      |

Eight charges created, and no order with freight is without one. Nothing already
posted was re-costed: those 38 metres keep the cost they were booked at, and the
freight that was never applied to them is not recoverable. This does not pretend
otherwise.

## Driven on screen, and it landed on the number

The final 2 metres were received through the UI as Devi, against slip
`AM-DN-4502`. GR-000002 reads:

| Item           | Units | Invoiced | Plus getting it here | Really cost, each |
| -------------- | ----- | -------- | -------------------- | ----------------- |
| Linen, natural | 2     | $18.00   | **$1.25** (3.4%)     | **$18.63**        |

and the summary beneath it:

> **$36.00** what the goods cost · **$1.25** getting them here, 3.4% of the
> total · **$37.25** what this stock is worth to you

$1.25, not another $25. The books agree:

```
PO-000001  received   charge $25.00   spent $25.00   left over $0.00
GR-000001  38 units   $18.00 invoiced   $23.75 freight   $18.63 landed
GR-000002   2 units   $18.00 invoiced    $1.25 freight   $18.63 landed
LINEN-NAT-200   on hand 40   average cost $18.63
```

40 x $18.63 = $745.20 against the $745.00 she actually paid, the twenty cents
being rounding that the final delivery's sweep is designed to absorb rather than
lose. The charge is spent exactly once.

## Two things the screen found that reading could not

**The word survived in one more place.** The charge kind `freight` was LABELLED
"Shipping", so the backfilled row rendered as `Shipping / Freight on the order`
in one table cell. Fixed, along with four inbound uses of "shipping" in copy and
comments that the first allowlist missed.

**The receipt then denied the money it was showing.** Its charges card said
"Nothing has been recorded on top of the supplier's invoice" with $1.25 printed
two inches above — 496's exact shape, on the other screen
([500](500-the-receipt-denied-the-freight-it-was-showing.md)).
