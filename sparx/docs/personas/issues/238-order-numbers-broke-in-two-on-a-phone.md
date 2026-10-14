# 238 — Order numbers broke in two on a phone

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · pane ratings (Customers › Customer orders, 360px)
**Surface:** every table that shows an order, invoice, document, gift card, unit or SKU code, sparx console and Piggles, narrow panes
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** P01, 2026-10-13, Customer orders in Doty's workbench at 360px
**Blocked on:** —

## What happened

On a phone, Customer orders showed each order number on two lines: "O-" over "000033",
"O-" over "000032". The browser breaks a line at a hyphen, and the order column gets
what is left after the others take their width.

The main Selling › Orders list was fixed for exactly this before (its cell carries
`whitespace-nowrap` and a comment saying why). The same cell in 13 other tables was not:
Customer orders, a customer's and a company's orders and documents, trade orders, trade
invoices, invoices, returns, a payout's sales, gift cards, units and the stock import.

## What should have happened

A code is one thing. It stays on one line; if the table is too wide, the table scrolls.

## How to reproduce

1. Customers › Customer orders, in a 360px pane.
2. Read the Order column.

## Why it matters

An order number is how Doty finds the order on the phone with a customer. "O-" on one
line and "000033" on the next reads as two things, and one of them is not a number.

## Where it lives

- Sparx: `<td className="font-mono …">` without `whitespace-nowrap` in
  `crm/customer-orders.tsx`, `crm/customer-related.tsx` (2), `crm/company-detail.tsx`
  (2), `b2b/orders-list.tsx`, `b2b/invoices-list.tsx`, `invoicing/invoice-list.tsx`,
  `commerce/returns-list.tsx`, `commerce/giftcards-list.tsx`, `finance/payout-detail.tsx`,
  `inventory/units-list.tsx`, `inventory/stock-import.tsx` (2).
- Piggles: the same cells; every one renders through `components/table.tsx`.

## The fix

A code cell keeps its code on one line. If the table is too wide, the table scrolls.
A figure (`tabular-nums`) is left alone: it has no hyphen to break at, and a company's
credit "$9,882.08 of $10,000.00" wraps its "of" line on purpose. `truncate` already
holds a cell to one line.

- Sparx has no table wrapper of its own, so the 20 code cells got `whitespace-nowrap`
  (the 13 tables above, plus quotes, cores, price lists, product types, content types
  and custom fields, which the guard found). The guard reads every table in the
  console, so the next one written cannot miss it.
- Piggles renders every table through `components/table.tsx`. The default lives there,
  once: `[&_td.font-mono:not(.tabular-nums)]:whitespace-nowrap` on the table. No
  surface file changed. (`b2b/account-statement.tsx` uses silica's `Table` directly; it
  has no code cell.)

Tests, red first: sparx `surfaces/table-codes-one-line.test.ts` (it listed the 20
cells), Piggles `components/table-codes-one-line.test.ts`. Sparx tests for b2b, cms,
commerce, crm, finance, inventory and invoicing: 1,244 pass. Lint clean. Typecheck not
run.

## Confirmed by

P01, 2026-10-13: Customers › Customer orders at 360px shows "O-000033", "O-000032" and
the rest each on one line. The total still sits past the right edge on a phone: one
row's "Collected, then refunded" badge (184px) sets the status column's width. That is
the wider phone layout for lists, not this defect. Piggles: The Marrow Review has no
orders, so its tables are not checked on screen.

## Rating effect

—
