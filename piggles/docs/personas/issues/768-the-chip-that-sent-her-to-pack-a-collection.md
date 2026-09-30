# 768 — The chip that sent her to pack a collection

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 272
**Surface:** `b2b.orders.list` and `commerce.orders.list`, both consoles
**Filed:** 2026-09-22
**Fixed:** 2026-09-22
**Confirmed by:** P03, pressing the chip and reading what came back
**Blocked on:** —

## What happened

Wholesale orders. The bar across the top is her work queue:

```
All   Not paid   To send   On the way   Delivered
```

She pressed **To send**, which is the question "what do I need to pack and post
today". Two rows came back:

| order    | business        | delivery       |
| -------- | --------------- | -------------- |
| O-000020 | Loom and Larder | **To send**    |
| O-000018 | Loom and Larder | **To collect** |

The second one is not being sent anywhere. Tamsin is driving over for it. If
Devi works the list the chip gave her, she pays postage on a parcel her
customer was coming to fetch, and then Tamsin arrives at a counter with nothing
on it.

**Delivered** does the same thing the other way: it returned O-000019, which the
same table marks **Collected**. Nobody delivered it. Tamsin picked it up.

## Why

An order carries two independent facts — what has happened to it, and how it is
travelling — and `order-tone.ts` next door already knows that. It went to real
trouble over it, and says so in its own comment:

> Every branch that can be reached by a collection now says which of the two it
> is.

| stored status | sent to them | collected by them |
| ------------- | ------------ | ----------------- |
| `placed`      | To send      | To collect        |
| `fulfilled`   | On the way   | Ready to collect  |
| `delivered`   | Delivered    | Collected         |

The chips filter on the stored status ONLY. There is no delivery-method filter
on the server, and the chips never claimed one — they just took their names from
the left-hand column and quietly promised half of it.
[[feedback_a_fix_leaves_its_neighbour_behind]]

MEASURED 2026-09-22, across the platform: **3 collections sit under "To send"
and 7 under "Delivered"**. On Juniper Row's own wholesale list it is 2 rows of 3.

## And there were four copies of the chips

```
piggles/apps/workbench/surfaces/b2b/orders-list.tsx             5 chips
piggles/apps/workbench/surfaces/commerce/orders-list-filters.ts 6 chips
sparx/apps/workbench/surfaces/b2b/orders-list.tsx               5 chips
sparx/apps/workbench/surfaces/commerce/orders-list.tsx          6 chips
```

Both wholesale copies were missing **Canceled**, so a canceled trade order could
not be picked out at all in either console, and there was no single place that
would have shown anyone the difference. The same shape as 767 the day before:
one list kept by hand in several places drifts, and every check stays green.
[[feedback_structural_checks_go_blind]]

## What was done

**A chip names the WORK, and the work is the same either way**: pick it and pack
it, whether it goes on a van or onto the counter.

| stored status | was        | is               |
| ------------- | ---------- | ---------------- |
| `placed`      | To send    | **To pack**      |
| `fulfilled`   | On the way | **Packed**       |
| `delivered`   | Delivered  | **They have it** |

Each is now a truthful superset of both badges it can return. `Not paid` and
`Canceled` are unchanged: a canceled order is canceled however it was going.

**One list per console.** `surfaces/commerce/orders-list-filters.ts` owns them
and both order lists import it, so the wholesale list has gained the Canceled
chip it had lost and cannot drift again.

**The empty-list advice stopped naming a marking that does not exist.** It said
_"no orders marked 'They have it'"_, and no row is ever marked that — a chip
gathers several markings at once. It now says which filter is on.

## Files

- `piggles/apps/workbench/surfaces/commerce/orders-list-filters.ts`, `sparx/…` — the one list
- `piggles/apps/workbench/surfaces/commerce/orders-list-filters.test.ts`, `sparx/…` — the guard
- `piggles/apps/workbench/surfaces/b2b/orders-list.tsx`, `sparx/…` — import it
- `sparx/apps/workbench/surfaces/commerce/orders-list.tsx` — imports it

## Proof

Read on screen 2026-09-22, the same button, after:

```
All   Not paid   [To pack]   Packed   They have it   Canceled

O-000020   Loom and Larder   Sep 22, 2026   Not paid    To send      $504.00
O-000018   Loom and Larder   Sep 20, 2026   Part paid   To collect    $52.00
```

Two ways of leaving the building under one honest word, with the Delivery column
saying which is which.

**The guard is a rule, not a list of words.** For each chip it renders both
delivery readings of that status and fails if the chip's label equals one of
them while differing from the other. Proved red by putting all three old labels
back:

```
+   "“To send” also returns orders marked “To collect”",
+   "“On the way” also returns orders marked “Ready to collect”",
+   "“Delivered” also returns orders marked “Collected”",
```

[[feedback_a_test_that_cannot_go_red]]
