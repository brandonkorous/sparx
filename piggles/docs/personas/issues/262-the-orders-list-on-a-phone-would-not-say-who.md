# 262 — The orders list on a phone would not say who

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 11 — "who bought", scored at 360px (RULE #6)
**Surface:** mypiggles › Sell › Orders
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

Devi's Monday question is _who bought_. The orders list answers it well on a
laptop — Order, **Customer**, Placed, Payment, Delivery, Total.

At 360px:

```
Order         Payment      Total
O-000006      Not paid     $51.00
O-000005      Part paid    $147.00
O-000004      Part paid    $170.00
O-000003      Not paid     $101.95
  Due Sat, Aug 29
```

Three columns, and the names are gone. Not scrolled off — dropped, with no
horizontal scroll to reach them and no fallback anywhere in the row.

## What should have happened

The list says who each order is for, at every width.

## Why it matters

- **It is the column the question is about.** "Who bought" on a phone gets back
  six machine labels and six amounts.
- **An owner does not think in order numbers.** She thinks "did Ravi's collection
  get sorted", "has Jo paid yet". `O-000001` is a filing reference; the person is
  the record. The list is sorted, filtered and searched by things she recognises
  — the search box even says _"Order number or customer…"_ — and then at phone
  width it will not print the half she actually searched by.
- Two orders are Tessa Wren's, for the identical $101.95. On a phone those rows
  are distinguishable only by an order number, which tells her nothing about
  which is which.

## Where it lives

[orders-table.tsx](../../../apps/workbench/surfaces/commerce/orders-table.tsx):

```tsx
<td className="hidden max-w-48 truncate @lg:table-cell">{customerName(order.customer)}</td>
```

`@lg` is 32rem, so below 512px the cell is simply not rendered. Placed (`@2xl`)
and Delivery (`@xl`) drop the same way, which is right — a date and a shipping
state are things you go and look up. A name is what you scan by.

## The fix

**The answer was already in the file, one line below.** The due day had exactly
this problem and was solved by moving it out of a column:

> "Under the number rather than in a column of its own, so it survives every
> width — the day a made-to-order job is due is the thing a shop that makes
> things scans this list for (issue 026)."

The customer's name now sits in the same place, under the order number, hidden
at `@lg` where its own column takes over — so it never appears twice:

```tsx
<span className="block truncate text-xs @lg:hidden">{customerName(order.customer)}</span>
```

## Confirmed

At 360px:

```
O-000006   Rowan Ellery                    Not paid    $51.00
O-000005   Jo Kim                          Part paid   $147.00
O-000004   Anneliese Vogt                  Part paid   $170.00
O-000003   Tessa Wren · Due Sat, Aug 29    Not paid    $101.95
```

At 1000px, the Customer column is back and the name appears once, not twice.

## Related

Found in the same 360px pass as [261], on the pair of screens act 11 sends an
owner to. Both had passed every automated check.

[[feedback_responsive_top2_rule]] · [[feedback_fetched_but_never_rendered]] —
the name was already in the row's data and in the DOM's own column definition;
the width just hid it with nothing put in its place.

## Rating effect

Orders, in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
