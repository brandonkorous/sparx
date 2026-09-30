# 750 — The Business column on Wholesale orders named the person

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 267
**Surface:** mypiggles workbench — Wholesale orders (`b2b.orders.list`)
**Filed:** 2026-09-20
**Fixed:** 2026-09-20
**Confirmed by:** P03, on the first wholesale order this console has ever taken
**Blocked on:** —

## What happened

The order from [748](748-a-shop-phones-an-order-and-there-is-nowhere-to-type-it.md)
landed, and the list read:

```
Order       Business       Placed         Payment     Delivery     Total
O-000018    Tamsin Vale    Sep 20, 2026   Part paid   To collect   $52.00
```

**Tamsin Vale is a person.** The business is Loom and Larder, which is the entire
reason this row is on Wholesale orders rather than on Orders.

## Nothing had to be fetched

The business was already on the row, three layers deep and drawn nowhere.

`ORDER_CUSTOMER_SELECT` in `@wizeworks/crm` joins it, and says why in its own
comment:

```ts
companyId: true,
// paymentTerms rides along so the B2B lens can show what an order is owed
// under without a second query.
company: { select: { id: true, companyName: true, paymentTerms: true, status: true } },
```

The console's own `OrderCustomer` type has carried it the whole time:

```ts
company: { id: string; companyName: string; paymentTerms: string | null; status: string } | null;
```

So the join exists, it was added FOR this lens, the type declares it, and the
cell rendered `customerName(order.customer)` instead — a function that is right
about people and was never asked about businesses.
[[feedback_fetched_but_never_rendered]]

## What was done

The column says the business and puts who rang underneath it, because both are
worth knowing and they are different questions: a shop has several people who
can order.

```
Business
  Loom and Larder
  Tamsin Vale
```

A row with no business on it falls back to naming the buyer rather than going
blank. On this lens that means the join came back empty, not that the order has
no business — and an empty cell would be a statement about the order rather than
about the read. [[feedback_never_present_absence_as_measurement]]

## Files

- `piggles/apps/workbench/surfaces/b2b/wholesale-order-row.ts` — new
- `piggles/apps/workbench/surfaces/b2b/wholesale-order-row.test.ts` — new
- `piggles/apps/workbench/surfaces/b2b/orders-list.tsx` — the cell

## Not in sparx

sparx's Wholesale orders has the same cell and the same join behind it, and no
way to create an order to see it with ([748](748-a-shop-phones-an-order-and-there-is-nowhere-to-type-it.md)).
It is left alone until that is answered, so the fix is made on a screen somebody
can actually walk. [[feedback_verify_capability_in_code_not_docs]]

## Proof

Ten tests, proved red by putting `customerName` back in the cell: **1 of 10** —
the structural half, because the pure function can be perfect over a column that
never calls it, which is exactly what this was.

**Read on the screen 2026-09-20**, once the join behind it worked
([751](751-the-join-that-was-never-there.md)):

```
Order       Business           Placed         Payment     Total
O-000018    Loom and Larder    Sep 20, 2026   Part paid   $52.00
            Tamsin Vale
```
