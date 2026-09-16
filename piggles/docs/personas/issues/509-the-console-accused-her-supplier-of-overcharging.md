# 509 — The console accused her supplier of overcharging, by exactly her own freight

**Status:** both halves fixed and proven
**Severity:** critical
**Found by:** Devi, entering Fairfield's invoice for the brass buckles
**Surface:** the supplier invoice panel and `draftBillFromReceipt`
**Filed:** 2026-09-14

## What she saw

She booked in 58 brass buckles at the agreed $3.60 and paid a courier $14.00 to
bring them. Then she entered Fairfield's invoice, which is one field: the number
off the paper. Everything else was filled in for her.

The bill came back:

> **They are asking for $222.72**
> The check: **1 line(s) do not agree** · **$13.92 more than the goods justify**
>
> | Line                | Ordered | Arrived | Billed | Each                | Check                                 |
> | ------------------- | ------- | ------- | ------ | ------------------- | ------------------------------------- |
> | Brass belt hardware | 60      | 58      | 58     | $3.84, agreed $3.60 | **Charged more than agreed · $13.92** |
>
> **Before this can be approved.** Either accept the difference, which is
> recorded against your name, or query it with the supplier, which stops it
> being paid.

**Fairfield billed exactly the agreed price.** The $13.92 is Devi's own courier
bill, which the console put inside the supplier's invoice and then flagged as the
supplier's overcharge.

Her two doors were: sign her name to an overcharge that never happened, or email a
supplier to dispute an invoice that is correct and stop paying it. On every order
that carries any freight.

## Why

`draftBillFromReceipt` seeded each line with the LANDED cost:

```ts
const unitCostCents = line.landedUnitCostCents ?? line.baseUnitCostCents ?? line.unitCostCents;
```

with a comment explaining it: _"Landed cost first: it is what the goods actually
cost us once freight and duty were spread over them, and it is the figure the
match should argue with."_

The match does not argue with landed cost. `matchBillLine` compares the bill line
against the **order's** agreed unit price, and the order's price is the
supplier's price. Seeding the bill with our own freight spread over the units
guarantees a variance of exactly the freight, every time.

It double-counted too: the same panel has its own **Freight** box underneath, so
an owner who filled it in as intended would record the carriage twice.

## The second half: nothing to correct it with

The panel says, above the table:

> Filled in from what was actually delivered. **Correct anything the paper says
> differently** — where the two disagree, the match will tell you.

The table was read-only text. Quantity and price could not be changed anywhere:
not in the panel, and not on the bill afterwards, where the only actions are
accept, query, and cancel the whole thing.

The panel's own docblock states the design:

> The panel fills in OUR side and asks the operator to correct it to THEIRS. That
> is not a nicety, it is the three-way match doing its job at the only moment it
> is cheap. **A bill created straight from the receipt would match the receipt
> perfectly by construction, and a match that cannot fail is not a check.**

And the API was built for it. `POST /v1/inventory/receipts/:id/bill` takes a
`lines` array, and its schema comment reads _"What the operator corrected the
draft to."_ The console had never sent one. So the three-way match compared our
numbers against our numbers, and the check that cannot fail was the one shipped.

## What changed

**The draft carries the supplier's price**, in the supplier's currency, because a
supplier's invoice is a copy of a piece of paper and not a figure we worked out.

**The lines are editable.** Quantity and price each are inputs, the amounts and
the total recompute as she types, and the payload sends the corrected lines. The
column header reads **Billed** rather than Received, because that is now what it
is.

## Proven

Before, on the linen delivery, the draft would have read $18.63 each / $37.25.
After:

```
Item                     Billed   Each     Amount
Linen, natural, 200gsm     [2]   [18.00]   $36.00
                                 $36.00 · 1 line · $36.00 of goods
```

which is what Ashcombe Mills actually billed, and agrees with the "$36.00 what
the goods cost" figure four inches above it on the same screen. Typing 18.50 into
the price moved the amount to $37.00 and the total with it; typing it back
restored $36.00. Entered as AM-2214, the price variance is gone.

## What it does not fix

That bill still flags, now on QUANTITY: it covers 2 units of an order for 40, so
the check reads "Billed for less than arrived · $684.00 in your favour". A
correct partial invoice against a multi-delivery order still needs an override.
Filed separately as [510](510-a-partial-invoice-reads-as-a-disagreement.md).
