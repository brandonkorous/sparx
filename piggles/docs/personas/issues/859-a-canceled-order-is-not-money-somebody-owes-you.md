# 859 — A canceled order is not money somebody owes you

**Status:** fixed
**Severity:** **major** — the filter an owner uses to find who still owes her
returned two canceled orders she cannot collect on, and hid two she can. One in
five rows on that list, platform-wide, owed nothing.
**Found by:** P03 · act 303, reading the Orders list while dev was down
**Surface:** mypiggles › Orders, and Wholesale orders, in both consoles
**Filed:** 2026-09-28
**Fixed:** 2026-09-28
**Confirmed by:** the database, row by row, against the product's own
`amountDue()` rule

## The chip said one thing and asked another

```ts
{ value: 'unpaid', label: 'Not paid', status: undefined, paymentStatus: 'unpaid' }
```

`payment_status = 'unpaid'` is a column value. "Who still owes me money" is a
question. They part company in both directions:

| the row               | the column says  | is it owed? |
| --------------------- | ---------------- | ----------- |
| a **canceled** order  | `unpaid`         | **no**      |
| a **part-paid** order | `partially_paid` | **yes**     |

A canceled order carries `unpaid` for the rest of its life. Nothing about the
payment machine knows the sale stopped. And a part-paid order never carries
`unpaid` at all, so the money she is still waiting for was invisible to the
filter built to find it.

## The five rows on her own list

```
                                        due     old chip   new chip
O-000010   canceled    unpaid         $0.00        in         out
O-000011   canceled    unpaid         $0.00        in         out
O-000016   fulfilled   part paid     $27.00        out        in
O-000018   placed      part paid     $22.00        out        in
O-000005   fulfilled   part refunded  $0.00        out        in   ← says so on its row
```

$252.60 of canceled orders she would have chased. $49.00 she was owed and could
not find. Her count barely moved, **18 → 19**, which is the part worth noticing:
the number looked fine while the rows were wrong.

## Platform-wide

```
the old chip returned        91 orders across 12 tenants
of those, owed nothing       18 orders across 10 tenants        ← one in five
of those 18, canceled        11 orders across 10 tenants
owed but not returned         2 orders
the new chip returns         77 orders
```

**Ten of the twelve tenants who have any orders had at least one.** It is not an
edge case; it is what the filter does.

## The rule was already written, one file over

`amountDue()` in `order-format.ts` — the function the order PANE uses to print
"Still owed $22.00" — opens:

> **What is still collectable on this order.**
>
> `total − amountPaid` alone is wrong at both ends of an order's life. A refunded
> order has had its money handed back, and a cancelled one is never going to be
> paid — both would otherwise report the FULL total as outstanding and **put a
> "still owed" banner on a sale nobody should be chasing**.

Somebody worked this out exactly, for one order at a time, and wrote down the
reasoning. The LIST that filters for the same thing asked a column instead. So
the pane said nothing was owed on O-000010 while the list counted it, two clicks
apart. [[feedback_a_fix_leaves_its_neighbour_behind]]

This is **857 again on the order side.** That issue's lesson was "two columns
that are always equal in your data are not the same column". Here the two columns
are `payment_status` and "is this owed", and they agree on every ordinary order,
which is nearly all of them.

## The label moved with the rule

The chip's own test file states the rule that catches this:

> A chip gathers both up, so **its own word has to be true of both** — or it
> sends a shop owner to do the wrong job on half of what it returns.

"Not paid" is false about a part-paid order. So the chip is now **"Still owed"**,
which is the word the order's own money block already prints on that very row.
The platform had the right word; the filter had a different one.

## One question, one place, and it composes

```ts
// crm-schemas — the rule
export function isOwingOrder(order: { status; paymentStatus }): boolean {
  if (NOT_COLLECTABLE_ORDER_STATUSES.includes(order.status)) return false;
  return OWING_PAYMENT_STATUSES.includes(order.paymentStatus);
}

// crm — the same rule as a query
export const OWING_ORDER_WHERE: Prisma.OrderWhereInput = {
  status: { notIn: [...NOT_COLLECTABLE_ORDER_STATUSES] },
  paymentStatus: { in: [...OWING_PAYMENT_STATUSES] },
};
```

It joins the existing `AND` rather than spreading its keys. **A spread was the
first draft and it was wrong:** `OWING_ORDER_WHERE.status` would have overwritten
an explicit `status` above it, so `?status=placed&owing=true` would have quietly
dropped the status and answered a wider question than it was asked. As a conjunct
it composes, which also makes **"placed AND still owed"** answerable at the API —
a real question the chips cannot ask, because they are a single-select row.

Four call sites, both consoles: shop Orders and Wholesale orders in each.

## The one case the words cannot decide, said plainly

A **part-paid order that has also been part refunded** needs the three amounts,
not the two words: whether anything is left is `amountPaid + refundTotal ≥ total`,
which a database `where` cannot ask without arithmetic on three columns. So those
orders are **shown**, not hidden — the same honest default `isPriceOfferWorkflow`
takes, because guessing would hide money rather than show too much.

Measured 2026-09-28: **2 such orders exist on the whole platform**, and both say
so on their own row. O-000005 reads "Part refunded · Paid in full, and some of it
has since gone back. **Nothing is owed.**" It is visible and it explains itself,
which is not the same kind of wrong as a canceled order counted in silence.

If that population ever grows, the exact-forever fix is a stored `amount_due`
column, which needs a migration.

## On screen, read from the live DOM

Dev came back up, and the whole thing was driven on her own pane.

The **Show** control now offers `All · Still owed · To pack · Packed · They have
it · Canceled`, and picking **Still owed** returns **19 rows** where it returned
18:

```
gone      O-000010   O-000011                      both canceled, nothing owed
arrived   O-000018   payment cell: Part paid       $22.00 owed
          O-000016   payment cell: Part paid       $27.00 owed
          O-000005   payment cell: Part refunded   the documented residual
```

The chip's word is now true of everything under it. "Part paid" is a row that is
still owed and "Not paid" was a lie about it; "Part refunded" is the one row the
two words cannot decide, and its own cell says which it is.

**"To pack" is unchanged at 8**, which is the check that the composing `AND` did
not disturb the other chips. Worth noting what those 8 hold: every payment cell
among them reads "Not paid" or "Part paid" — **not one of the orders she is about
to post has been paid for in full.**

## Proved

**10 tests** on the rule, and **proved red** by deleting the not-collectable
clause: 2 of 10 fail. **3 new tests** on the chips in each console, **proved red**
by putting the old chip back: 2 of 8 fail.

The chip test that existed already said "asks for exactly one server answer per
chip" and named `status` and `paymentStatus` in its assertion, so replacing the
payment field would have left it passing while checking a field that no longer
existed. It now counts over an exported `CHIP_SERVER_FIELDS` list.
[[feedback_structural_checks_go_blind]]

**Checks:** typecheck 0 on `crm-schemas`, `crm`, `api-rest` and both workbenches.
Tests: crm-schemas 4 files / 70, crm 28 / 277, api-rest 33 / 269, piggles
workbench commerce+b2b 29 / 320, sparx chips 8. Guards `em-dashes`,
`plain-words`, `copy-key-sentences`, `nav-vocabulary`, `price-offers`,
`console-parity`, `boundaries`, `american-spelling` green. ESLint and prettier
clean.

## Files

- `wizeworks/packages/crm-schemas/src/orders.ts` (the rule, and `owing` on the list input)
- `wizeworks/packages/crm-schemas/src/owing-order.test.ts` (new)
- `wizeworks/packages/crm/src/services/order-service.ts` (`OWING_ORDER_WHERE`, applied)
- `wizeworks/packages/crm/src/index.ts`
- `wizeworks/services/api-rest/src/routes/v1/orders.ts` (`?owing=true`)
- `{piggles,sparx}/apps/workbench/surfaces/commerce/orders-list-filters.ts` · `.test.ts`
- `{piggles,sparx}/apps/workbench/surfaces/commerce/orders-list.tsx`
- `piggles/apps/workbench/surfaces/commerce/order-queries.ts` · `sparx/…/commerce/data.ts`
- `{piggles,sparx}/apps/workbench/surfaces/b2b/orders-data.ts` · `orders-list.tsx`

## The thing to remember

**A filter is a sentence, and nobody proofreads a filter.** Six words in an array
literal decided what "who owes me money" means for every shop on the platform,
and the words in the label and the words in the query were different claims.
Every check was green: the column existed, the value was right, the chip
rendered, the server answered. It answered a question nobody asked.

And the smaller one, which is the third time this pass: **the right reasoning was
already in the repository, in a neighbouring file, with the exact case written out
in a comment.** `amountDue()` names cancelled and refunded and says why. Reading
the comment next door would have been faster than measuring the database — and
the only reason the database was measured is that the screen looked fine.
