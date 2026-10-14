# 226 — A fleet's invoice hid what they bought and the sales tax

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · standing checks (open an invoice link while signed out)
**Surface:** the invoice raised for a web order on account: Renée's copy on the site, the emailed copy, Doty's in Invoicing; the orders export
**Filed:** 2026-10-11
**Fixed:** 2026-10-12
**Confirmed by:** P01, 2026-10-12, Renée's INV-000029 and INV-000030 on the site
**Blocked on:** —

## What happened

Renée opened INV-000028 from its email. It had one line:

> Order O-000029 · non-taxable · 1 · $28.41 · $28.41

The order was a Stanadyne additive at $12.50, UPS Ground $15.00 and Utah sales tax $0.91.
The invoice named no part, folded the shipping and the tax into one line, and marked
that line "non-taxable" while it carried tax.

Every invoice for a taxed web order on account is like this: INV-000020 to INV-000028,
nine invoices, $3,985.06. Invoices for orders with no tax list their parts
(INV-000015, INV-000018).

## What should have happened

The invoice lists the part, the shipping and the sales tax, as the order did (issue 095
made order invoices list their items).

## How to reproduce

1. As Renée on the site, buy one Stanadyne additive on account, delivered by UPS Ground.
2. Open the invoice from the email, or Doty's copy in Invoicing. One line, every time
   the order has tax.

## Why it matters

Wasatch's accounts team matches each invoice to its purchase order and books the sales
tax separately. This one says neither what was bought nor how much tax was paid, and it
calls taxed money "non-taxable". Wrong on a tax document, for every fleet order since
Gillett turned sales tax on (act 9).

## Where it lives

- `wizeworks/packages/commerce/src/services/checkout-service.ts`, `complete()`: the order
  items are written with no tax; the tax goes to the order as one total
  (`taxTotal`). The checkout already holds each line's tax, in the session's
  `taxBreakdown.lines`, keyed only by position (`lineRef`).
- `wizeworks/packages/crm/src/services/ar-invoice-lines.ts` `itemizedFromOrder`: builds
  the invoice from the items, and keeps the one-line invoice when the items do not come
  to the order total. Items with no tax come to $27.50 against $28.41, so it always
  fell back.
- The same empty item tax shows in the orders export's line tax column
  (`api-rest/src/routes/v1/orders-export.ts`).

## The fix

Each order item now carries its own sales tax, so the invoice can list it.

- `commerce/src/services/checkout-service.ts` `quoteTaxForSession`: each quoted tax line
  is stamped with the basket line it taxes (`cartItemId`); the basket is read in a
  fixed order. `commerce-schemas/src/tax.ts` `TaxBreakdownLine` gains the optional
  `cartItemId`.
- `commerce/src/services/order-line-tax.ts` (new) `taxByCartItem`: each basket line's tax
  from the session's quote, used only when the lines and the shipping's tax come to the
  session's tax to the cent. An older quote, or one that does not add up, hands out
  nothing, and the order keeps its one tax total as before.
- `complete()` writes each item with that tax. The order's own tax total is unchanged
  (it is still passed as the header figure).
- With the items taxed, `itemizedFromOrder` (crm `ar-invoice-lines.ts`) lists the part,
  the shipping and the tax on the account invoice, and "Make an invoice" (crm
  `billing-from-order-service.ts`, which takes its tax rate from the items) no longer
  bills a taxed web order with no tax at all. The orders export's line tax column is
  filled in too.
- The neighbor this would have broken: Selling's top products summed each line's
  `lineTotal`, which now carries tax. `reporting-service.ts` counts what the lines sold
  for, after discount and before tax.

Not changed: the nine invoices already issued (INV-000020 to INV-000028). They were sent
to Wasatch; their amounts are right; rewriting a sent invoice is not this fix's to do.

Tests, red first: `checkout-line-tax.test.ts` (2, the real `complete()`; red before),
`checkout-tax-collection.test.ts` (+1, red with the stamp taken out),
`order-line-tax.test.ts` (5), `top-products-revenue.test.ts` (2, red before). commerce
555, commerce-schemas 620, crm 415, b2b 110 pass. Lint clean. Typecheck not run
(Brandon: leave it for now).

## Confirmed by

P01, 2026-10-12, as Renée on the site. She bought Stanadyne additives on account,
UPS Ground, twice:

- O-000030 (2 at $12.50, PO WUC-PO-4471): the order line kept its $1.81 of tax.
  INV-000029 lists the additive, Subtotal $25.00, Tax $1.81, Shipping $15.00, Total
  $41.81. No "Order O-000030 · non-taxable" line.
- O-000031 (1 at $12.50, PO WUC-PO-4472): INV-000030 lists the additive, Subtotal
  $12.50, Tax (7.25%) $0.91, Shipping $15.00, Total $28.41.

Proving it on screen found two more defects on the same invoice: the row printed its
amount with the tax in ([227](227-a-printed-invoice-row-added-its-tax-in.md)), and the
rate read 7.24% ([228](228-an-invoice-printed-a-tax-rate-nobody-charged.md)). Both are
fixed.

## Rating effect

—
