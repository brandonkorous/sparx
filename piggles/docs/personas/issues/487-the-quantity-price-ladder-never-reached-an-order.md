# 487 — The quantity price ladder never reached a purchase order

**Status:** fixed
**Severity:** major
**Found by:** Devi ordering sixty buckles against a ladder that starts at fifty
**Surface:** `inventory.purchase-orders.detail` (both consoles)
**Filed:** 2026-09-09

## What was wrong

The Quantity prices card on a supplier says what a ladder is for:

> Set the ladder here and **a purchase order picks the right price for the
> quantity being ordered** — and tells the buyer what the next step down would
> save.

She set one: $4.10 each, $3.60 from fifty. Then she raised an order for sixty.
The line came out at **$4.10 each, $246.00**, and said nothing about the rung it
had cleared. The right answer was $3.60 and $216.00 — thirty dollars, on one line
of one order, on a promise the console made her four minutes earlier.

## Why

The server resolves ladders correctly and has a tested function for it:

```ts
// resolvePurchasePrice(60, 410, ladder).unitCostCents === 360
```

It is consulted under one condition, stated in the service's own comment:

> _"Only consulted when the buyer did not type a cost — an explicit figure is a
> negotiated one and always wins."_

That is a good rule. The screen defeats it: the moment an item is chosen, the
dialog fills Cost each with the supplier's BASE price, and Cost each is required.
So every line arrives carrying a cost, the server reads it as negotiated, and the
ladder can never fire from the one screen that raises orders by hand.

**The screen was typing a price on her behalf and the server was treating it as
hers.**

## The fix

The dialog reads the ladder for the chosen item and prices the line at the
QUANTITY, using `resolvePurchasePrice` — the same function the server uses, so
the figure on screen and the figure written are one answer. A `costTouched` flag
draws the line the server's rule depends on: a figure she typed is hers and is
never overwritten, and a line already on the order opens touched, because the
price it carries was agreed when it was added.

The second half of the promise is kept too. Under Cost each:

- **"Their price for 50 or more."** when a rung has been applied
- **"Order 50 or more and they charge $3.60 each."** when there is one above

## Proven

Quantity 1: $4.10, and "Order 50 or more and they charge $3.60 each." Changed the
quantity to 60 without touching the price: the box moved to **3.60**, the note
became "Their price for 50 or more.", and the line total became **$216.00**.
Saved as PO-000002 at $216.00.
