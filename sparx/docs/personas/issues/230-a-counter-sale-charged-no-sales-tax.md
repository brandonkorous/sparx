# 230 — A counter sale charged no sales tax

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · standing checks (tax on a discounted retail line)
**Surface:** Take a sale (Orders, and Wholesale orders "rang through"), both consoles; the order, receipt and invoice it writes
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** P01, 2026-10-13, Take a sale in Doty's workbench (O-000032); Piggles' Take a sale opened and drew its tax row
**Blocked on:** —

## What happened

Gillett collects Utah sales tax at 7.25% (switched on in act 9; the website's checkout
charges it, issues 137 and 226). Doty rang up an Edge CTS3 Backup Camera (98203),
$299.95, for Brynn O'Hara-Løvdal at the counter. Take a sale asked for **$299.95**:
no tax line anywhere on the screen, "Paid in full: $299.95". With tax it is $321.70.

The screen never asks for a tax figure, and the order it writes carries none: the
order service sums each item's tax, and the sale sends none. Every counter sale since
Gillett switched tax on has charged $0.00 of it. (The twelve counter and quote orders so
far are from Oct 2, before act 9, so none of them owed it.)

## What should have happened

The sale adds Utah sales tax as the website's checkout does for a part collected at the
shop: on the shop's address, after any lower price, never on a core deposit, and not for
a buyer with a tax certificate on file (O'Malley Ranch). The total asked for includes
it, and the order, its receipt and its invoice show it.

## How to reproduce

1. Workbench › Take a sale. Brynn O'Hara-Løvdal. Add "98203".
2. The total is $299.95. No tax.

## Why it matters

Gillett owes Utah 7.25% on every taxable sale it makes, whether it charged it or not.
Every counter sale comes out of Doty's own pocket at tax time, and his books under-state
the tax he owes. Counter sales are most of a parts shop's walk-in trade.

## Where it lives

- `sparx/apps/workbench/surfaces/commerce/sale-detail.tsx`, `sale-data.ts`
  (`useTakeSale` posts `/v1/orders` with no `taxAmount` on any item and no `taxTotal`),
  `sale-core.ts` (`saleTotals` has no tax), `sale-lines.tsx`.
- The same files in `piggles/apps/workbench/surfaces/commerce/`.
- The website's checkout quotes tax in `commerce/src/services/checkout-service.ts`
  `quoteTaxForSession`, with the shop's own address for a collected order (issue 137).
  Nothing like it exists for a sale with no cart.

## The fix

The counter sale asks the same tax engine the website's checkout uses, shows the tax
on its own row, adds it to what it asks for, and writes it onto the order.

**Server.**

- `wizeworks/packages/commerce/src/services/sale-tax.ts` (new) `quoteTaxForSale`: the
  shop's own address as the place (as for a collected checkout order, issue 137), each
  line at the price this customer is charged, the buyer's and their wholesale
  account's tax certificates, product tax classes. A line typed in by hand or an hour
  of labor is taxed at the place's general rate. Returns each line's tax by the till's
  own line id, the one rate charged, and whether a certificate is on file.
- `POST /v1/commerce/tax/sale-quote` (`api-rest/src/routes/v1/commerce/shipping.ts`,
  beside the other tax routes).
- `commerce-schemas/src/tax.ts`: a tax line's `variantId` and `productId` are optional,
  for a line that sells nothing from the catalog. The two provider plugins do not read
  them.

**Sparx workbench** (`sparx/apps/workbench/surfaces/commerce/`).

- `sale-tax.ts` (new): asks the server, keys the answer to the exact sale (customer,
  lines, quantities, prices) and names the row: "Sales tax (7.25%)", or "Sales tax
  (none: their tax certificate is on file)".
- `sale-core.ts`: the totals carry `tax` and the total includes it; `saleItem` carries
  each line's tax; new `saleOrderBody` writes the order with each line's tax, the
  order's `taxTotal` and `metadata.taxRateBasisPoints` (so an invoice made from it
  prints the rate, issue 228). `sale-data.ts` posts that body.
- `sale-detail.tsx`: asks for the tax when the sale changes (a short wait, so a typed
  price asks once), and "Write it down" waits until the tax for this exact sale is
  known. If the server cannot be asked, it says so and offers Try again; it never
  writes the sale without its tax.
- `sale-lines.tsx`: Subtotal, any core deposits, the sales tax row ("Working it out…"
  until known) and the Total, whenever something is on the sale.

**Piggles workbench**: the same, in its own files. Its till was split to keep each file
under 250 lines and each function under 50: `sale-take.ts`, `sale-order-body.ts`,
`sale-sellables.ts`, `sale-sellable-picker.tsx`, `sale-old-part-choice.tsx`,
`sale-totals-rows.tsx`, `sale-sections.tsx`, `sale-line-from.ts`, `use-counter-sale.ts`,
`use-agreed-pricing.ts`, `use-sale-payment.ts`, `use-sale-tax.ts`, `sale-tax.ts`
(all new), with `sale-data.ts`, `sale-lines.tsx`, `sale-detail.tsx` cut down. Moved code
is unchanged except one thing: an agreed price that came back for a basket since
changed is now thrown away by the key it was asked with, as the sparx till does; the
old check compared the basket with itself and always passed. The source guards in
`sale-core.test.ts`, `sale-taking.test.ts` and `sale-sellable-search.test.ts` now read
the files the code moved to; the core and tax guards are `sale-till-guards.test.ts`.

Tests, red first: commerce `sale-tax.test.ts` (5, the real tax engine against Gillett's
Utah place; the certificate test red with the certificates left out); sparx
`sale-tax.test.ts` (9; red before, `saleOrderBody` did not exist; the line-tax test red
with the line tax left off); Piggles `sale-tax.test.ts` (9). commerce 567,
commerce-schemas 620, sparx commerce surfaces 482, Piggles commerce surfaces 518 pass.
Lint clean on every touched file. Typecheck not run (Brandon: leave it for now).

## Confirmed by

P01, 2026-10-13, Doty in Take a sale:

- Brynn O'Hara-Løvdal, Edge CTS3 Backup Camera (98203): Subtotal $299.95, "Sales tax
  (7.25%) $21.75", Total $321.70, and the amount taken filled in as $321.70.
- The same with the price typed down 15% to $254.96: tax $18.48, as worked by hand
  ($254.96 × 7.25% = $18.4846). Written down as **O-000032**: Items $254.96, Tax $18.48,
  Order total $273.44, paid, collected. The order item holds $18.48 of tax and the
  order holds the rate, 725.
- Seamus O'Malley (O'Malley Ranch, Utah agricultural certificate on the account): the
  camera at his wholesale $263.96, "Sales tax (none: their tax certificate is on file)
  $0.00". Not written down.

Piggles, as The Marrow Review (another agent's business; nothing written down): Take a
sale opens after the split, and a line written in draws Subtotal, Sales tax $0.00 (it
has no tax place switched on) and Total.

## Rating effect

—
