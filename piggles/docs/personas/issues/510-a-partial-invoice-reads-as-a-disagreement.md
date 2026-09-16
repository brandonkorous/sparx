# 510 — A correct partial invoice read as a disagreement

**Status:** fixed and proven
**Severity:** major
**Found by:** Devi, entering Ashcombe's invoice for two replacement metres
**Surface:** the three-way match on a supplier bill, both consoles
**Filed:** 2026-09-14

## What she saw

Ashcombe Mills sent two replacement metres for the water-stained ones and billed
for those two. She entered the invoice exactly as it reads: 2 at $18.00, $36.00.

> **$36.00** · The check: **1 line(s) do not agree** · **$684.00 in your favour**
>
> | Line                   | Ordered | Arrived | Billed | Each   | Check                                      |
> | ---------------------- | ------- | ------- | ------ | ------ | ------------------------------------------ |
> | Linen, natural, 200gsm | 40      | 40      | 2      | $18.00 | **Billed for less than arrived · $684.00** |
>
> **Before this can be approved.** Either accept the difference, which is
> recorded against your name, or query it with the supplier.

The invoice is right. The price agrees. Nothing is wrong, and both doors she was
offered were wrong: sign off a variance that never happened, or dispute a
supplier who did nothing unusual.

## Measured

```
order line 182e5135 · PO-000001 · 40 ordered · agreed $18.00
receipts:   GR-000001  38 units   2026-09-09
            GR-000002   2 units   2026-09-10
bills:      AM-2214     2 units   (this one)
```

Two drops. One invoiced. The other 38 metres have simply not been invoiced yet.

## Why

The bill was compared against the whole ORDER:

```ts
const received = poLine.receiptLines.reduce((sum, r) => sum + r.quantityReceived, 0);
```

Every receipt on the order, not the part this invoice covers. On an order that
arrives in more than one drop and is billed per drop, every invoice but the last
reads short.

## The one nobody had seen, which is worse

The same blindness runs the other way. **A supplier who invoices the same drop
twice matched perfectly, both times**, because neither invoice on its own
exceeds what arrived. Nothing in the check looked at the other invoices at all,
so there was no way for it to know the delivery had already been paid for.

That is the failure that actually costs money, and it was sitting behind the one
that only annoyed.

## And a third, found while writing the test

Quantity was decided before price:

```ts
qtyVariance > 0 ? 'over_billed'
  : qtyVariance < 0 ? 'under_billed'
  : priceVariance > TOL ? 'price_higher' : ...
```

So a partial invoice that ALSO overcharged reported only the shortfall. Harmless
while a shortfall blocked the bill. Fatal the moment it stopped.

## What changed

**The check counts the other invoices.** `matchBillLine` takes
`alreadyBilledQuantity`, and compares against what is LEFT to invoice rather
than against everything that arrived. Omit it and behaviour is unchanged, so a
one-drop, one-invoice order is exactly as it was.

**Money is decided before a shortfall.** `not_received`, `over_billed`,
`price_higher` and `price_lower` are all tested ahead of `under_billed`.

**A shortfall never blocks a payment.** `under_billed` is `needsReview: false`.
Being charged for less than arrived costs the business nothing; it means another
invoice is coming. It is reported, never disputed. The badge now reads **"Rest
still to be invoiced"**, not "Billed for less than arrived".

**Two figures, not one.** `amountVarianceCents` is the money wrongly charged
here; `uninvoicedCents` is what the goods nobody has invoiced are worth. Folding
the second into the first made an overcharging partial invoice announce
**$680.00 "in your favour"** while thanking a supplier for a $4.00 overcharge.

**The screen explains itself.** The Arrived column says how much of the delivery
is on other invoices, because a row reading "arrived 40, billed 2, agrees"
cannot be understood without it. And the pass message no longer claims a partial
invoice "matches what arrived", because it does not.

## Proven, both directions

Ashcombe's real invoice, AM-2214:

> The check: **Agrees with the delivery** · $684.00 of this order is still to be invoiced
> Everything charged here is at the agreed price, for goods that arrived. The
> rest of this order has not been invoiced yet.
> | 40 | 40 | 2 | $18.00 | **Rest still to be invoiced** · $684.00 |

Then the 38-metre drop entered as AM-2198:

> The check: **Agrees with the delivery** · nothing at stake
> | 40 | **40 · 2 on other invoices** | 38 | $18.00 | **Agrees** |

Then the same drop invoiced a second time, AM-2231:

> The check: **1 line(s) do not agree** · **$684.00 more than the goods justify**
> | 40 | **40 · 40 on other invoices** | 38 | $18.00 | **Billed for more than arrived** · $684.00 |

**The duplicate is caught. Under the old code it could not have been.**

## Proven red

Each new guard was broken on purpose and the tests watched to fail:

| break                                         | tests that redden |
| --------------------------------------------- | ----------------- |
| `billable = received` (ignore other invoices) | 2                 |
| quantity tested before price again            | 1                 |
| a queried bill counted as already invoiced    | 1 (DB-backed)     |

Full suites after: commerce-schemas 463, inventory 366, piggles workbench 232,
sparx workbench 157. Six new tests, four of them against the real schema, since
the fault that mattered most lived in what the SERVICE feeds the match rather
than in what the match decides.
