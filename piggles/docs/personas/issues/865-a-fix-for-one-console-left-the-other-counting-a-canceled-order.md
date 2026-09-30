# 865 — A fix for one console left the other counting a canceled order

**Status:** fixed
**Severity:** **moderate** — a customer's overview card in the sparx console
prints their order count and lifetime spend, and lists their three most recent
orders directly beneath. The figures leave canceled orders out. The list did not,
so on any customer with a canceled order in their last three the card totalled
something the rows beside it contradict, and the canceled row pushed a real one
off the bottom. Fixed in the Piggles console as issue 332 and **never mirrored**
**Found by:** P03 · act 307, while reaching for the same flag in the chat panel's
new order list and finding it absent from the sparx order query
**Surface:** sparx workbench › CRM › a customer › Overview
**Filed:** 2026-09-28
**Fixed:** 2026-09-28
**Confirmed by:** the database, and the flag now reaching the endpoint

## The two halves of one card

Piggles, with the reason written down:

```ts
// `countedOnly` because these rows sit directly under the figures above, and
// those figures leave cancelled orders out. Without it the card said "3 orders,
// $582.60" over three rows summing to $636.90, one of them cancelled, having
// pushed off the only order she had actually been paid for (issue 332).
const ordersQ = useOrders({ customerId: customer.id, countedOnly: true, … });
```

sparx, same card, same file name:

```ts
const ordersQ = useOrders({ customerId: customer.id, sortBy: 'placedAt', … });
```

And the flag was not merely unset. **`countedOnly` is absent from sparx's
`OrderQuery` altogether**, so the console had no way to ask: the shape stops at
`status`, `paymentStatus`, `owing`, `customerId`. The parameter exists on the
endpoint (`GET /v1/orders?counted_only=true`, added for issue 332) and sparx never
learned to send it.

## What it costs, measured

```sql
WITH ranked AS (
  SELECT customer_id, status,
         row_number() OVER (PARTITION BY customer_id ORDER BY placed_at DESC) rn
    FROM orders WHERE customer_id IS NOT NULL
)
SELECT count(DISTINCT customer_id) FROM ranked
 WHERE rn <= 3 AND status IN ('cancelled','refunded');
```

**18 customers, across 10 businesses**, have a canceled or refunded order inside
their three most recent. Juniper Row has 2 of them; so does WizeWorks.

## Why the question is not a status filter

`counted_only` is not `status != 'cancelled'` written out longhand. It is one
shared constant:

```ts
export const UNCOUNTED_ORDER_STATUS: OrderStatus = 'cancelled';
```

read by the customer rollup that writes `orderCount` and `totalSpent`:

```ts
/** Orders that never happened do not count toward anything. Shared with the
 *  order list's `countedOnly`, so a list beside these figures shows the same
 *  orders they were computed from (issue 332). */
const COUNTED = { not: UNCOUNTED_ORDER_STATUS } as const;
```

and by the order list. The figures and the list read the same constant, so they
agree by construction rather than by two people remembering the same rule. That
is why the fix is the flag rather than a filter at the call site: a filter would
have been a third copy of the rule, and the one thing issue 332 bought was that
there is only one.

The service also lets an explicit status win over the flag, with its own note
("asking for cancelled orders and getting none would be the worse surprise"), so
the full Orders **tab** on the customer stays correct and unchanged: that list is
meant to show everything.

## Proved

The wire now carries it (`counted_only: 'true'`), the query shape declares it with
the same comment as the other console, and the overview card asks for it. Typecheck
0 on the sparx workbench; tests 30 files / 299 across chat, crm and commerce;
ESLint and prettier clean.

Not covered by a test, and worth saying plainly: this is a call-site flag in a
`.tsx`, and there is no seat in either console's test setup that renders a
customer overview. The guard that would catch it is a console-parity check that
compares `surfaces/**`, which is already a carried item — `check:console-parity`
does not look there at all today, which is exactly how a fix stayed in one console
for a release cycle.

## Files

- `sparx/apps/workbench/surfaces/commerce/data.ts` (`countedOnly` on the query, and the wire)
- `sparx/apps/workbench/surfaces/crm/customer-overview.tsx` (the card asks it)

## The thing to remember

**A fix has a mirror, and the mirror is not a file that looks similar.** Issue
332's fix landed in one console with a paragraph explaining itself, and the other
console kept the bug **and the missing vocabulary to express the fix** — so
whoever next tried to mirror it by hand would have found `countedOnly` does not
compile there and had to choose between adding it and filtering locally. The
cheaper wrong answer was available. [[feedback_a_fix_leaves_its_neighbour_behind]]

And the way it surfaced is the general lesson: I found it by trying to **reuse**
the flag in a new place. A shared helper is the thing that makes a one-console fix
visible, because the second console fails to compile the moment somebody reaches
for it.
