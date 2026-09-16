# 486 — A price of "3,60" was saved as $360

**Status:** fixed
**Severity:** major
**Found by:** Devi setting Fairfield Trims' price for fifty buckles or more
**Surface:** 13 money fields in piggles, 24 in sparx
**Filed:** 2026-09-09

## What was wrong

The ladder's Price each box was `<Input type="number" step="0.01">`. She typed
`3,60`. The browser dropped the comma and handed the form `360`, which was
accepted, saved, and confirmed with a toast: _"Purchase orders for Brass belt
hardware, antique will use them from now on."_

A price of $3.60 became **$360.00**, and the next purchase order would have used
it.

## This is issue 086, and the fix for it is in the repo

`money-input.tsx`'s header is about precisely this:

> _"It was, and a browser number field REFUSES text it cannot parse by handing
> back the empty string. So typing `8,50` — a comma for the cents, which is how
> most of the world writes money — arrived at `onChange` as `''`… A price became
> free, silently, with the field showing a number she never typed."_

`MoneyTextInput` and `MoneyInput` were built to replace `type="number"` money
fields. **Thirty-seven of them were still there.**

## What was swept

Every `<Input type="number" step="0.01">` bound to an amount, in both consoles:

- Stock: the supplier's price each, the ladder rung, three fields on a supplier's
  bill, the amount paid on a bill, two on a supplier return, the spending limit,
  and the purchase-order line's Cost each (sparx only — piggles had already been
  migrated)
- Sell: an account credit, a bundle's fixed price, a discount's minimum spend
- Customers: a trade account's credit limit

`invoicing/line-editor-numbers` was left alone: its box holds a markup, which can
be a percentage, so it is not money.

## The other half: five copies of one broken parser

Swapping the field is only half of it — the value still has to be READ. There
were five near-identical local copies of `dollarsToCents` and two of
`inputToCents`, all built on `Number(...)` or `Number.parseFloat(...)`, all
carrying 086. One had already been migrated and shows the shape:

```ts
function dollarsToCents(value: string): number | null {
  if (value.trim() === '') return null;
  return moneyCents(value); // scheduling/policy-detail.tsx
}
```

All seven now delegate the same way, so "8,50", "$8.00" and "1,250.00" are read
wherever they are typed, and blank still means "not set" rather than zero.

## Proven

Typed `3,60` into the ladder and saved. The database holds `min_quantity 50,
unit_cost_cents 360` — three dollars sixty. The rung also renders as `3.60`
rather than `3.6`, because a price showing one decimal beside "$4.10 each" reads
as a typo.
