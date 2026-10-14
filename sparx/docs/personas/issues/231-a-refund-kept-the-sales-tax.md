# 231 — A refund kept the sales tax the buyer paid

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · standing checks (a core refund on a partial return)
**Surface:** the website's return form; "Give the money back" on a return, both consoles; the refund recorded on the order
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** P01, 2026-10-13, Brynn's return from O-000033 (site form and Doty's refund)
**Blocked on:** —

## What happened

Brynn O'Hara-Løvdal bought two Bosch Remanufactured Fuel Injectors (0986435621) at the
counter, O-000033: 2 × $600.00, $87.00 of Utah sales tax, $300.00 of core deposits,
$1,587.00 paid. She sent one back.

- Her return form said: "At the price you paid, this comes to $600.00, and $150.00 of
  core deposit comes back with it."
- Doty's "Give the money back" filled in **$600.00** and offered "Mark $750.00 as given
  back".

She paid $643.50 for that injector: $600.00 and $43.50 of tax. The right refund is
$793.50. The suggested one keeps $43.50 of her money, and Gillett would still be
reporting tax on a sale that was undone.

The same figure ignores a line's discount: a line sold with a discount code was
suggested back at full price, more than the buyer paid.

## What should have happened

What a returned item comes to is what the buyer paid for it: its price after any
discount, plus the sales tax on it. The form and the refund both say so, and the
refund gives it back.

## How to reproduce

1. Take a sale: 2 × Bosch 0986435621 for Brynn (tax on).
2. As Brynn, return 1. The form says $600.00.
3. As Doty, approve, receive, Give money back. $600.00 is filled in.

## Why it matters

A refund short by the tax is money kept that is not the shop's, on every taxed return
since act 9. The buyer can see it on her receipt, and Utah sees it on the return.

## Where it lives

- `wizeworks/packages/commerce/src/services/return-service.ts` `returnability`: gives
  each line its `unitPriceCents` only. `refundShareByLine` shares a refund across lines
  by unit price.
- `wizeworks/apps/site/lib/return-value-words.ts` `returnValueOf`: unit price × units.
- `sparx/apps/workbench/surfaces/commerce/return-detail.tsx` `suggestedCents`: unit
  price × units. Piggles: `return-refund-figures.ts`, and `return-detail-record.tsx`.

## The fix

One rule for what returned units cost the buyer, used by the return form, the refund
the shop is offered, and how the refund is split across the order's lines.

- `wizeworks/packages/commerce-schemas/src/return-paid.ts` (new): `paidLine` reads an
  order line's goods after their discount and its sales tax, in cents; `paidForUnits`
  is the share of both for some of its units, never more than the line.
- `commerce/src/services/return-service.ts`:
  - `returnability` (the return form's data) gives each line `goodsPaidCents` and
    `taxPaidCents`.
  - `get` (a return's record) gives each returned line `paidGoodsCents` and
    `paidTaxCents` for the units accepted back.
  - `refundShareByLine` splits a refund across lines by what each was paid, tax
    included, instead of by unit price.
- Site, `wizeworks/apps/site/lib/return-value-words.ts`: the form adds the tax she paid
  and says so: "At the price you paid, with its sales tax, this comes to $643.50". An
  older API with no figures claims no tax.
- Sparx console: `return-refund-figures.ts` (new) starts "Give the money back" from those
  figures; `return-refund-words.ts` `paidBackNote` says under the amount "That is what
  they paid for it, with $43.50 of sales tax."; `return-detail.tsx` and
  `return-actions.tsx` use them.
- Piggles console: `return-refund-figures.ts` the same, and `paidTaxOf` so the dialog
  (`return-refund-modal.tsx`) says the tax from the return itself; the 299-line
  `return-detail-moves.tsx` was not touched.

Tests, red first: commerce-schemas `return-paid.test.ts` (5); commerce
`return-paid-lines.test.ts` (3: the form's figures, the record's figures, the split; the
split red with the tax taken out of it); site `return-value-words.test.ts` (4 new or
changed, red before); sparx `return-refund-figures.test.ts` (5, red with the tax left
out); Piggles `return-refund-figures.test.ts` (6). commerce 569, commerce-schemas 625,
site lib 430, sparx commerce surfaces 487, Piggles commerce surfaces 524 pass. Lint
clean. Typecheck not run.

## Confirmed by

P01, 2026-10-13, Brynn's O-000033 (2 injectors, $1,200.00, tax $87.00, deposits
$300.00, paid $1,587.00), one sent back:

- Doty's "Give the money back" filled in $643.50, said "That is what they paid for it,
  with $43.50 of sales tax.", added the $150.00 deposit and offered "Mark $793.50 as
  given back", the hand count. Settled: the order holds a $643.50 refund for the part
  and a $150.00 refund for the deposit; 1 of 2 refunded; 1 core still owed.
- Brynn's return form for the other injector now reads "At the price you paid, with its
  sales tax, this comes to $643.50, and $150.00 of core deposit comes back with it."
  Not sent.

## Rating effect

—
