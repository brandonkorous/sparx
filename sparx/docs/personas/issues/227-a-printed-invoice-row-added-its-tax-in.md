# 227 — A printed invoice row added its tax in, so the row did not add up

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · proving 226 on screen (Renée opens INV-000029)
**Surface:** every printed or emailed invoice, quote and estimate (the site's copy, the PDF, the emailed copy, the workbench preview)
**Filed:** 2026-10-12
**Fixed:** 2026-10-12
**Confirmed by:** P01, 2026-10-12, Renée's INV-000029 on the site
**Blocked on:** —

## What happened

Renée opened INV-000029 on the site. Its one row read:

> Stanadyne Diesel Fuel Additive … · 2 · $12.50 · **$26.81**

Two at $12.50 is $25.00. The row's amount had the line's $1.81 sales tax added in.
Under it the Subtotal said $25.00 and Tax said $1.81 again, so the rows did not
add up to the Subtotal and the tax looked charged twice.

Doty's editor in Invoicing shows the same row as $25.00. The printed copy and the
editor disagree.

Before 226 no web order's invoice had a taxed row, so this was rare; a hand-made
invoice with a taxable line always printed this way.

## What should have happened

Each row's amount is quantity times unit price, the figure the Subtotal adds up and
the editor shows. Tax shows once, in the totals.

## How to reproduce

1. As Renée, buy two Stanadyne additives on account (Utah tax applies).
2. Open the invoice from Wholesale account › Invoices. The row reads $26.81.

## Why it matters

Wasatch's accounts team checks each row: 2 × $12.50 is not $26.81. A row that
does not add up is a reason not to pay the invoice until someone calls Gillett.

## Where it lives

- `wizeworks/packages/crm/src/services/billing-document-html.ts` `lineTableHtml`: the
  Amount column prints `lineTotal`, which is the row after discount plus tax.
- The three places that build those rows feed it `lineTotal`:
  `billing-render-service.ts` (the live document and a frozen snapshot) and
  `billing-draft-render.ts` (an unsaved draft).
- The editor (`sparx/apps/workbench/surfaces/invoicing/line-items.tsx`) prints
  `lineSubtotal`.

## The fix

A printed row is worth quantity times unit price, the figure the Subtotal adds up.

- `crm/src/services/billing-document-html.ts`: `BillingRenderLine.lineTotal` became
  `amount`, documented as the row before tax. `withCoreRows`, which all three render
  paths already call, now takes each line's `lineSubtotal` and sets `amount` from it
  (a core deposit's row is the deposit times the quantity, as before). The new
  `BillingSourceLine` type names what the paths hand it.
- `billing-render-service.ts` (live document and frozen snapshot) and
  `billing-draft-render.ts` (unsaved draft) pass `lineSubtotal`. The draft's own
  `computeLineTotal` is gone; it uses `computeBillingLine`, the function the save path
  uses.
- The neighbor: the invoice template preview's sample rows
  (`api-rest/src/routes/v1/invoicing/templates.ts`) named the old field and would
  have printed "$NaN". Renamed, with its test.

A frozen snapshot already held `lineSubtotal` for every line, so invoices sent before
the fix print correctly too.

Tests, red first: `crm/test/unit/billing-document-html.test.ts` "a printed row" (2;
red on the old code, the row printed $26.81 and the amounts were undefined). crm 557,
api-rest `invoice-tree-render` 4 pass. Lint clean. Typecheck not run (Brandon: leave
it for now).

## Confirmed by

P01, 2026-10-12, as Renée on the site. INV-000029 now reads "2 · $12.50 · $25.00",
Subtotal $25.00, Tax $1.81. INV-000030 reads "1 · $12.50 · $12.50".

## Rating effect

—
