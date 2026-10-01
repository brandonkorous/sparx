# 894 — A customer record that did not know about its own order

**Status:** fixed
**Severity:** **major** — the card said "Orders 3" and "Last order a week ago"
and "$569.20 still to come" four inches above the order itself, dated that day,
for $1,008.00. The figure she would have chased was understated by $1,008.00,
and every saved group and scoring rule that reads those fields was reading them
too
**Found by:** P03 · act 317, sweeping Customers by data weight
**Surface:** mypiggles › Customers › any customer's own pane, and everything
downstream of `customers.total_spent` / `order_count` / `last_order_at` — both
consoles, every tenant
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** a source guard of 7 assertions over every order-writing path,
proved red four ways; and her own screen, before and after, through a real
quote converted to a real order

## What she saw

Tamsin Vale of Loom and Larder, her wholesale buyer. One pane, no scrolling:

```
Their orders come to     Paid you so far      Orders     Last order
$599.20                  $30.00               3          a week ago
$199.73 an order         $569.20 still                   First September 20
on average               to come
```

and, below it, under **Recent orders**:

```
Their 3 most recent. All 4 are on the Orders tab.

O-000028   To send        Sep 30, 2026      $1,008.00
O-000020   On the way     Sep 22, 2026        $504.00
```

Three contradictions, all visible at once:

- **"Orders 3"** over a line saying **"All 4 are on the Orders tab."**
- **"Last order a week ago"** over a row dated **that same day**.
- **"Their orders come to $599.20"** over a single order for **$1,008.00**.

The row and the sentence about it were both right. The four cards were built
from stored figures on the customer, and those figures had never been told.

## Measured

```
                       stored    true
order_count                 3       4
total_ordered          599.20  1607.20
last_order_at      2026-09-22   2026-09-30
total_spent             30.00     30.00   ← correct: nothing new was paid
```

Of Devi's eight customers with orders, exactly one disagreed with its own
orders, and it was the one holding an order created that morning by turning an
accepted quote into an order.

## The rule, and the two writers who were never told

These figures are not nudged. They are DERIVED, from the orders, inside the
transaction that writes the order. `order-events.ts` still carries the
paragraph explaining why:

> _"They were, as `{ increment: payload.total }` plus a matching decrement on
> refund, and an increment is only ever as reliable as its delivery. Three of
> five orders on one shop never reached the buyer's record — the failure was
> swallowed by the bus's own catch — and because the refund half kept working,
> one customer's lifetime spend rendered as -$42.00."_

So `recomputeCustomerCommerce` became the rule for every path that writes an
Order. Four learned it:

```
orderService.create            ✓
orderService.update            ✓
the payment path               ✓
channel order ingest           ✓
```

Two did not:

```
billing-document-conversion-service.ts    a QUOTE becoming an order
import-worker/processors/orders.ts        an order history moved in
```

Both write `tx.order.create(...)` directly and return.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## The importer is the worse half

The customer importer, in the same folder as the order importer, **refuses** a
`total_spent` column from the spreadsheet and tells the person so in the file
report. Its reason is in the file:

> _"SMS opt-in, lifetime spend, order count and 'customer since' are NOT on that
> list: ... the spend and order figures are **worked out from the person's
> orders** (so a typed-in copy would be replaced by the next order)"_

That is a promise, stated to the person who is moving their business onto the
platform, about a job its neighbour was not doing. The ordinary route in —
import the people, then import their order history — left every one of those
people reading **$0.00 across 0 orders** with all of their orders sitting on the
next tab. [[feedback_a_promise_in_copy_is_a_contract]]

Devi never hit that half, because she typed her customers in. Anyone arriving
with a history would have hit nothing else.

## Why one of the two quote orders looked fine

Both of the platform's quote-converted orders belong to Tamsin. Only one was
wrong:

```
O-000020   converted 22 Sep, later FULFILLED   → counted
O-000028   converted 30 Sep, untouched since   → missing
```

`orderService.update` calls the rule. So a quote-converted order became visible
to its own customer the moment anything else happened to it, and stayed
invisible until then. On net terms that is thirty days of a customer record
understating what it is owed, and the repair, when it came, looked like nothing
had ever been wrong.

That is the shape that makes this hard to notice and worth a guard rather than
a test: the defect heals itself in front of whoever goes looking.

## What it does now

Both paths call the same rule in the same transaction that writes the order.
No new arithmetic: `recomputeCustomerCommerce` already existed, already had its
own tests, and already got the hard parts right — refunds, cancelled orders
excluded, a lifetime spend that can never go negative.

The import worker calls it on **both** branches, because a re-run of an import
is an update and an updated order changes the same figures.

## Proved

A **source guard** of 7 assertions asking the question of ALL the writers rather
than of any one of them, because "one of several forgot" is what this was:

```
the conversion's call removed                  →  2 fail
the importer's call removed                    →  2 fail
a scan root goes stale (a tree is moved)       →  4 fail
the rollup itself stops writing                →  1 fail
```

The third is the one that matters most. A guard that hard-codes a path is one
refactor away from scanning nothing and printing green, so it asserts its roots
exist and prints its denominator. [[feedback_structural_checks_go_blind]]

## The probe that found a hole in my own guard

My first version asked whether each writer's file **contained** the word
`recomputeCustomerCommerce`. I took the call back out of the conversion service
to prove the guard could go red, and it stayed green.

The `import { recomputeCustomerCommerce }` line at the top of the file satisfied
it. **An unused import is the exact residue a deleted call leaves behind**, so
the one shape the guard had to tell apart was the one shape it could not. It now
looks for the open bracket, and a test pins that leftover-import case so it
cannot come back. [[feedback_a_test_that_cannot_go_red]]

Worth writing down because the guard looked finished and passed on the real
tree. Only breaking it deliberately showed it was measuring the wrong thing.

## Verified through the real thing

Not only the guard. On her own console I wrote a quote for Tamsin — **Q-000019**,
twenty linen shirtdresses at $18 — moved it to **Accepted**, and used **Turn it
into an order**, which made **O-000029**.

Her card, before and after, with nothing else touched:

```
                        before      after
Their orders come to    $599.20     $1,967.20
an order on average     $199.73       $393.44
still to come           $569.20     $1,937.20
Orders                        3             5
Last order          a week ago         today
Recent orders      "All 4 are…"   "All 5 are…"
```

It went to **5**, not 4. Deriving repaired the order that had been missing since
that morning at the same time as it counted the new one, which an increment
never could have. That is the argument for the rule, shown rather than argued.

## Checks

`@wizeworks/crm` 30 files / 293 tests, `@wizeworks/import-worker` 7 / 81,
piggles console 173 / 1619, sparx workbench 142 / 1301 — all green. Typecheck 0
on crm, import-worker, api-rest and both consoles. 69 of 70 structural checks
pass; the 70th, `check:deletability:build`, was already red at HEAD, and its
dependency-closure form reports clean. ESLint and prettier clean.

## Files

- `wizeworks/packages/crm/src/services/billing-document-conversion-service.ts`
- `wizeworks/services/import-worker/src/processors/orders.ts`
- `wizeworks/packages/crm/src/services/order-writers-recompute.test.ts` (new)

Both fixes are in `wizeworks/`, so both brands get them from one change.

## Test data left in place

Quote **Q-000019** (Accepted) and order **O-000029** for Loom and Larder, plus
the task the seeded automation opened for it, "Q-000019 was approved: take it to
the next step". They are the proof, and the standing rule is to leave what
testing creates.

The task reads **To do** rather than Overdue, which is issue 892's fix holding
on a record written after it landed.

## Also checked and correctly not filed

**"0 of 38 match" on a group's own pane**, when she has 41 customers. The
preview counts the people a group can actually CONTAIN — one site's customers
plus the tenant-wide ones — which is 29 + 9 = 38 exactly. The file says so, and
records the earlier defect where it did not: a rule builder once said "24 of 24
match", the owner saved, and 22 arrived, the other two belonging to a different
business under the same tenant.

**Six groups reading "No members yet."** At Risk, High Value and VIP customers
are empty because nobody matches: her largest customer has spent $180 against
thresholds of $5,000 and $10,000, and no customer has gone 90 days quiet. The
count is a measurement, not an absence.

**Two tables that look like one thing twice.**
`inventory_po_approval_rules` governs when HER OWN purchase order needs a
sign-off; `purchase_approval_rules` governs when a WHOLESALE CUSTOMER's order
does. Different questions, different owners, correctly separate.

## The thing to remember

**A rule that lives in every writer is a rule no writer is told about.** There
was no interface to implement, no type that failed, and no test of any one path
that could notice — each writer was complete and correct on its own terms.

The measurement that finds it is not "does this path work". It is **"list every
place this row gets written, and ask each one the same question."** Four said
yes and two said nothing, and the two that said nothing were the two a business
uses to arrive: moving a history in, and turning a quote into a sale.
