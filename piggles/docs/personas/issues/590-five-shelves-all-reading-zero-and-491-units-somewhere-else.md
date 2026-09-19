# 590 — Five shelves all reading zero, and 491 units somewhere else

**Status:** fixed and proven on screen
**Severity:** medium
**Found by:** Devi, on Stock → Shelves
**Surface:** `wizeworks/packages/inventory/src/services/warehouses.ts` · `piggles|sparx/apps/workbench/surfaces/inventory/{location-stock-line.ts,bins-list.tsx,locations-list*}`
**Filed:** 2026-09-16
**Family:** [[feedback_absent_behaves_like_fine]] · [[feedback_never_present_absence_as_measurement]]

## What she saw

| Shelf  | Location           | Kind      | Units |
| ------ | ------------------ | --------- | ----- |
| RECV   | Fulfillment Center | Goods in  | **0** |
| A-01   | Fulfillment Center | Picking   | **0** |
| A-02   | Fulfillment Center | Picking   | **0** |
| B-01   | Fulfillment Center | Picking   | **0** |
| BULK-1 | Fulfillment Center | Overstock | **0** |

Five shelves, nothing on any of them, and **491 units of stock in the business**.
Nothing on the screen said why.

A zero has two opposite meanings. The shelf is empty, or nothing can ever be on
it. Those want different things from the reader, and this screen made them look
identical.

## Why

The answer was in the Location column the whole time, and needed a second screen
to see it.

```sql
select t.name, w.name,
  (select count(*) from inventory_bins b where b.warehouse_id = w.id) bins,
  (select coalesce(sum(l.on_hand),0) from inventory_levels l where l.warehouse_id = w.id) on_hand
from inventory_warehouses w join tenants t on t.id = w.tenant_id where w.deleted_at is null;
```

| tenant          | location               | shelves | units   |
| --------------- | ---------------------- | ------- | ------- |
| **Juniper Row** | **Fulfillment Center** | **5**   | **0**   |
| **Juniper Row** | **Main Warehouse**     | **0**   | **491** |
| Threadline      | Fulfillment Center     | 3       | 12,162  |
| Threadline      | Main Warehouse         | 3       | 0       |

**Every shelf she has is at one location. Every unit she owns is at the other,
which has no shelves at all.**

And the Locations list could not tell her either. It showed name, kind, where and
state, and nothing whatever about what was in the place.

So one fact was missing from two screens, and each screen's silence made the
other's harder to read.

## The fix

The fact is counted **once**, on the locations list, and both screens read it.

```ts
// Two grouped queries over the page's warehouses, rather than two per row.
const [levels, bins] = await Promise.all([
  tx.inventoryLevel.groupBy({
    by: ['warehouseId'],
    where: { warehouseId: { in: ids } },
    _sum: { onHand: true },
  }),
  tx.inventoryBin.groupBy({
    by: ['warehouseId'],
    where: { warehouseId: { in: ids } },
    _count: { _all: true },
  }),
]);
```

`onHand` and `binCount` are **nullable**, and null is what a single location read
on its own returns. A 0 there would claim the place is empty when the truth is
that nothing asked ([[feedback_never_present_absence_as_measurement]]).

**Locations**, now, under each name:

> Fulfillment Center · FC-1 · **Nothing here · 5 shelves**
> Main Warehouse · MAIN · **491 units · no shelves**

**Shelves**, now, above the table:

> **None of these shelves has anything on it. Your stock is at Main Warehouse,
> which has no shelves, so there is nowhere here for it to show.**

Both verified in the browser.

## Three states, not one

The note has one branch per real situation, because "no stock on any shelf" is
three different problems:

| State                                              | What it says                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| Stock exists, at a place with no shelves           | names the place: "Your stock is at Main Warehouse, which has no shelves" |
| No stock anywhere at all                           | "there is no stock anywhere else either"                                 |
| Stock is at a place WITH shelves, nothing put away | "though you hold 250 units... once a delivery has been put away"         |

And it stays silent in three more: a shelf on screen has something on it, the
table is empty (the list's own empty state owns that, and says something better),
or the locations have not loaded yet.

That last one matters. A note that decides before the facts arrive is how a pane
came to report the server unreachable over a link that was fine, so
`locations.data ? activeLocations : null` gates it and the null branch waits.

## Proven

**`location-stock-line.test.ts`** — 12 tests in each console, including "1 unit ·
1 shelf" (never "1 units"), "12,162 units" with its thousands separator, and a
property: every branch that speaks at all must leave the reader somewhere.

Putting the old behaviour back — no line on the locations list, no named place in
the note:

```
× says what is in the place and whether it has shelves
× counts in ones without saying "1 units"
× groups the thousands, because 12162 is not a number anybody reads
× says NOTHING when nobody counted
× names where the stock actually is
× lists every place holding unshelvable stock
```

**6 of 12 red.**

|                 |                                           |
| --------------- | ----------------------------------------- |
| piggles console | **499 pass** (60 files)                   |
| sparx console   | **401 pass** (51 files)                   |
| typecheck       | inventory, api-rest, both consoles exit 0 |
| console parity  | PASS (0 divergent)                        |
| lint / prettier | clean                                     |
