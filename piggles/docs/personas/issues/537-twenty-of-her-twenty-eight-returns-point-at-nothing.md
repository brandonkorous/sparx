# 537 — Twenty of her twenty-eight returns point at nothing

**Status:** fixed, migration run, and proven
**Severity:** high
**Found by:** Devi, opening her returns list
**Surface:** `db/prisma/schema/43-commerce-returns.prisma`, migration `20270512000000_a_return_cannot_outlive_its_sale`
**Filed:** 2026-09-16
**Follows:** [225](issues) — which named the symptom honestly and left the cause

## What she saw

Sell → Returns. Twenty-eight rows. From the ninth down:

> | Order | Customer         | Asked        | Wants        | Items | Stage         |
> | ----- | ---------------- | ------------ | ------------ | ----- | ------------- |
> | —     | The sale is gone | Aug 18, 2026 | Money back   | 1     | Nothing to do |
> | —     | The sale is gone | Aug 18, 2026 | Money back   | 1     | Nothing to do |
> | —     | The sale is gone | Aug 17, 2026 | Store credit | 1     | Nothing to do |
> | …     |

**Twenty of her twenty-eight returns.** 71% of the list is rows she cannot open,
cannot act on, and cannot remove. There is no filter chip that hides them, so she
scrolls past them every time.

## Measured

```sql
select count(*) as total, count(*) filter (where o.id is null) as orphaned
from commerce_return_requests r left join orders o on o.id = r.order_id;
```

| scope          | returns | pointing at nothing |
| -------------- | ------- | ------------------- |
| Juniper Row    | 28      | **20 (71%)**        |
| whole platform | 83      | **35 (42%)**        |

Across 4 tenants. **Zero** of them have a null `order_id` — all 35 carry a real
uuid that resolves to no row. Every one has a line item, and **every one of those
line items points at an order item that is gone too.**

## Why

```
\d commerce_return_requests

Foreign-key constraints:
    commerce_return_requests_tenant_id_fkey  →  tenants(id)
```

That is the whole list. `order_id` has **no foreign key**, and no Prisma relation
either. It is the only relation on the table without one: `tenant`, `items`,
`inspections` and `labels` all have theirs. `commerce_return_line_items.order_item_id`
has the same gap.

So an order can be deleted and its returns simply stay, pointing into space. The
database was never asked to stop it.

## The part worth remembering

**Issue 225 already found this screen.** Its fix was the copy:

```tsx
/* A null order number means the SALE is gone, and then "Unknown customer" is a
   guess dressed as a fact — the customer is not unknown, there is nobody to
   know (issue 225). */
{
  row.orderNumber === null ? 'The sale is gone' : row.customerName;
}
```

That copy is good and honest and should stay. But it is a **label on a symptom**,
and the symptom then went on happening for another 35 rows. A screen that says
"Nothing to do" twenty times is telling the owner the truth about a row that
should not exist.

## Fixed

Two Prisma relations declared (`ReturnRequest.order`, `ReturnLineItem.orderItem`),
both `onDelete: Cascade`, because a return dies with its sale, and migration
`20270512000000_a_return_cannot_outlive_its_sale`:

1. **Delete** the returns with no order, looping tenants and setting the tenant
   context. Their lines, inspections and labels follow on the cascades that
   already exist. `RAISE NOTICE` per tenant and a total.
2. **Delete** any surviving line whose order item is gone. None exist today; the
   step is there because a migration must not assume the measurement it was
   written against.
3. **Add both foreign keys.**

The loop is not decoration. These tables FORCE row level security and the
migration role is not a superuser in production, so a plain `DELETE` matches zero
rows there while passing locally, and reports success either way. Migration
20270418 learned that the hard way.

## Run, 2026-09-16

Authorized and applied with `prisma migrate deploy` against the development
database. It was the only pending migration, and it sorts after the newest
applied one (`20270511000000`), so the monotonic-name rule held.

Re-measured immediately before running, rather than trusting the figures this
issue was written against. They were unchanged: 83 returns, 35 dangling, 4
tenants; 83 return lines, 35 with no order item.

Every row it would delete was written to JSON first, so the delete is
reversible: 35 returns, 35 lines, 14 inspections, 14 labels.

|                       | before | after  |
| --------------------- | ------ | ------ |
| return requests       | 83     | **48** |
| of those, dangling    | **35** | **0**  |
| return line items     | 83     | 48     |
| inspections           | 35     | 21     |
| labels                | 32     | 18     |
| Juniper Row's returns | 28     | **8**  |

Two tenants (Halo & Hem, Thistle & Rye) had nothing BUT dangling returns and now
have none, which is the honest count: they never had a return anybody could act
on.

All 8 of Devi's remaining returns resolve to a real order with a real customer:

| status    | order    | customer           |
| --------- | -------- | ------------------ |
| exchanged | O-000015 | Marguerite Adeyemi |
| exchanged | O-000014 | Marguerite Adeyemi |
| exchanged | O-000016 | Marguerite Adeyemi |
| exchanged | O-000005 | Jo Kim             |
| approved  | O-000007 | Marguerite Adeyemi |
| refunded  | O-000004 | Anneliese Vogt     |
| refunded  | O-000005 | Jo Kim             |
| exchanged | O-000004 | Anneliese Vogt     |

## The constraint proven, both directions

```
INSERT a return whose order_id does not exist
  ERROR: violates foreign key constraint "commerce_return_requests_order_id_fkey"
  DETAIL: Key (order_id)=(5922…) is not present in table "orders".

INSERT a return against a REAL order        INSERT 0 1   (control)

DELETE one order that has returns
  returns_before  8
  DELETE 1
  returns_after   6                          (rolled back)
```

So it now refuses to create the state, and clears it when the sale goes.

Step 1 deleted 35 rows across 4 tenants, plus 63 children on the cascades that
already existed. They referenced nothing and could not be rendered truthfully,
but it was a delete, and the rows are kept in the session scratchpad.

## Files

- `wizeworks/packages/db/prisma/schema/43-commerce-returns.prisma`
- `wizeworks/packages/db/prisma/schema/24-crm-orders.prisma`, `25-crm-order-items.prisma`
- `wizeworks/packages/db/prisma/migrations/20270512000000_a_return_cannot_outlive_its_sale/migration.sql`
