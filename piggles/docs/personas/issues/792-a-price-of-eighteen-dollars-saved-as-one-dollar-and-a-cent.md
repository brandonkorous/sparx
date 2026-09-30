# 792 — A price of eighteen dollars saved as one dollar and a cent

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 279
**Surface:** mypiggles + sparx workbench — `commerce.product.configurator`, `commerce.configurator-template.detail`
**Filed:** 2026-09-23
**Blocked on:** —

## What happened

Devi monograms scarves, so she set up a build on the Silk twill scarf: one
question, "Would you like it monogrammed?", with two answers. The second one
costs eighteen dollars more.

She typed **18** into "Adds to price". The field showed **1.01**.

```
Answer                          Adds to price
Three initials, hand stitched   1.01
```

Nothing said anything was wrong. Save it and the scarf is monogrammed for a
dollar and a cent.

## Why

`MoneyTextInput` is a CONTROLLED field: it draws exactly the text it is handed,
and it settles to two decimals on BLUR and only on blur. That is deliberate, and
the file it lives in says why:

> Formatting on every keystroke is worse: it fights the operator. Typing "12."
> would round to "12.00" before they reach the cents.

Every caller of it holds the typed text verbatim — except the two build editors,
which held CENTS and rebuilt the text on every render:

```ts
const deltaText =
  choice.priceDeltaCents === undefined ? '' : String((choice.priceDeltaCents / 100).toFixed(2));
```

So each keystroke was a reformat:

```
type "1"   →  100 cents  →  field redrawn as "1.00", caret to the end
type "8"   →  "1.008"    →  101 cents  →  field redrawn as "1.01"
```

The component had solved this. The call site put it back.

Second, smaller, same root: text that could not be read at all was coerced to
"no change to the price" —

```ts
priceDeltaCents: moneyCents(text) ?? undefined;
```

`moneyCents` returns null for unreadable text, and `?? undefined` turns that
into "nothing extra", silently, which is the exact coercion `read-money.ts` was
written to stop.

sparx was worse again: both of its build editors were still a raw
`<Input type="number">` with `Number(value)`, which is the original issue 086
bug — "8,50" arrives as the empty string and the price becomes free.

## What was done

**A control for an owner that stores cents.** `MoneyCentsInput` holds the typed
text itself and follows the stored amount only when that amount moves for some
other reason and the field is not being typed into — the rule `MoneyInput`
already followed. Four call sites became one line each, and a fifth cannot
repeat the mistake, because there is now a control that takes what they have.

**Unreadable text keeps the amount already stored** and says so, under the row
rather than inside an eight-character column:

```
Adds to price
eighteen                    ← field turns red
That does not look like an amount. Try something like 8.50.
```

**Blank means nothing set**, not zero. Clearing the field used to write 0 and
redraw as "0.00".

`readCents` and `optionalMoneyText` are pure and tested; the tests were proved
red against the old shape.

## Proof

Driven as Devi on the Silk twill scarf:

```
typed          field shows     line under the row
18             18              Choosing this changes the price by +$18.00.
18.50          18.50           Choosing this changes the price by +$18.50.
eighteen       eighteen        That does not look like an amount…
```

## Files

- `piggles|sparx/apps/workbench/lib/read-money.ts` — `readCents`, `optionalMoneyText`
- `piggles|sparx/apps/workbench/lib/read-money.test.ts` (+11)
- `piggles|sparx/apps/workbench/components/money-input.tsx` — `MoneyCentsInput`
- `piggles|sparx/apps/workbench/surfaces/commerce/product-configurator.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/configurator-template-detail.tsx`
