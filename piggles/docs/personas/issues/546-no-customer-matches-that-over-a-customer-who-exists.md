# 546 — "No customer matches that", over a customer who exists

**Status:** fixed and proven
**Severity:** high
**Found by:** Devi, typing a customer's name into a box that asks for a customer's name
**Surface:** `@wizeworks/db` + 8 search boxes across crm, staff, b2b, scheduling, api-rest
**Filed:** 2026-09-16
**Family:** [[feedback_one_outcome_two_causes]] · [[feedback_a_fix_leaves_its_neighbour_behind]]

## What she saw

Sell → Orders. The box says **"Order number or customer…"**. She typed what a
customer gives you on the phone:

> **Jo Kim**
>
> ![empty] **No orders match that**
> _"Try part of an order number, or the customer's name, company or email."_

Jo Kim has two orders, worth $273.30 between them.

Invoices → Bill to → Customer. The box says **"Search by name, email or
company…"**. She typed **Wren Ashcombe**:

> **No customer matches that. Add them in Customers first.**

Wren Ashcombe is in her address book, with an email address, and has an invoice
for $276 open against her.

## The shape

A person's name lives in TWO columns and is typed as ONE string. Every one of
these boxes asked whether the whole typed string was a substring of one column:

```ts
OR: [
  { firstName: { contains: q, mode: 'insensitive' } },
  { lastName: { contains: q, mode: 'insensitive' } },
  { email: { contains: q, mode: 'insensitive' } },
];
```

"Jo Kim" is inside neither "Jo" nor "Kim". Nothing matches, and nothing ever
could.

## Measured

```sql
select count(*) as customers,
       count(*) filter (where first_name <> '' and last_name <> '') as two_part_names
from customers where deleted_at is null;
```

| customers on the platform | with both a first and a last name |
| ------------------------- | --------------------------------- |
| 651                       | **635**                           |

Nearly the whole address book, unfindable by the name they are called.

`grep "firstName: { contains"` — **eight** boxes with the identical shape:

| where                                      | the box                           |
| ------------------------------------------ | --------------------------------- |
| `crm/services/customer-service.ts`         | Customers, and the invoice picker |
| `crm/services/order-service.ts`            | Orders                            |
| `crm/services/billing-document-service.ts` | Invoices                          |
| `staff/src/members.ts`                     | My Team                           |
| `b2b/src/approval.ts`                      | Orders waiting for approval       |
| `scheduling/src/waitlist.ts`               | The waitlist                      |
| `api-rest/routes/v1/finance/payments.ts`   | Money paid to you                 |
| `api-rest/routes/v1/commerce/lists.ts`     | Account credit                    |

## Why it is worse than an empty list

The empty list then gives advice, and the advice is wrong in a way that costs
her something. **"Add them in Customers first"** is said to somebody looking
straight at a customer who exists, so the remedy on offer is to create a SECOND
copy of that person — a duplicate customer, with their orders and their money
split across two records.

One invoice on this shop had already been through it: see issue 547.

## The fix

One rule, in `@wizeworks/db/src/name-search.ts`, used by all eight.

Split what was typed on whitespace and require EVERY word to match somewhere.
"Jo Kim" becomes (something contains "Jo") AND (something contains "Kim"), which
the two name columns satisfy between them.

`AND` rather than `OR` is the deliberate half: matching any word would return
every Jo and every Kim on the books, which is a longer wrong answer than the
empty one. A single word behaves exactly as before, so this is never narrower
than what it replaces.

It returns clauses to SPREAD into an existing `AND` array rather than an object
to merge into the `where`. The customer list already carried an `AND` of its own
— the site-visibility scope that decides which rows a site may see at all — and
a second `AND` key would have replaced it in silence.

## Proven

Sell → Orders, "Jo Kim":

| order    | placed       | payment       | total   |
| -------- | ------------ | ------------- | ------- |
| O-000010 | Aug 27, 2026 | Not paid      | $126.30 |
| O-000005 | Aug 25, 2026 | Part refunded | $147.00 |

Invoices → Customer, "Wren Ash" → **Wren Ashcombe · wren.ashcombe@example.com**.

10 guards in `commerce/src/services/name-search.test.ts`, proven red by putting
the single-token version back (6 of 10 fail).
