# 169 — Her $128 overshirt came out at $128,000

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 3
**Surface:** mypiggles › Sell › Add a product
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** the Sunday Trouser added at $110.00, click-and-type, first try — below

## What happened

First product Devi ever added. **Sell → Products → Add a product**, and the form
asks for a name and a price.

The Price box showed **0.00**, right-aligned and pale. She clicked it and typed
her price — `128.00`. The box then read:

> **128000.00**

Not an error, not a warning. A tidy, plausible, formatted number, a thousand
times what she meant, sitting in the field that decides what a customer is
charged. The only thing standing between that and her website is whether she
happens to look at the box again before pressing **Add product**.

The mechanism is the pale 0.00: it is not a placeholder, it is a real value in
the box. Clicking put the caret in front of it, `128.00` went in ahead of the
zeros, and the field settled the result.

Emptying the box first and typing `128.00` gives `128.00`. So it works, as long
as you already know to clear a field that looks empty.

## What should have happened

An empty box. Nobody has said what this product costs yet, and "0.00" is an
answer — a specific one, meaning free. A price nobody typed must never be sitting
in the field as though somebody did.

## How to reproduce

Every time.

1. Console → **Sell** → **Products** → **Add a product**.
2. Type a name, e.g. `The Ash Overshirt`.
3. Click once in **Price**, at or near the left of the box.
4. Type `128.00`.
5. The field reads `128000.00`.

## Why it matters

Wrong money, on the first screen of the first job, arriving as a number that
looks deliberate. There is no "are you sure", because as far as the software is
concerned she typed a hundred and twenty-eight thousand dollars.

There is a second half, quieter: nothing stopped a product being added at **0.00**
either, on a form whose own words are "Every product needs a price and a code
before anyone can buy it". A shop can be filled with free things by pressing
Add product without touching the box.

Not a blocker, because she sees the number and it is one field to correct. Major,
because it is money and it presents as correct.

## Where it lives

[product-detail.tsx](../../../apps/workbench/surfaces/commerce/product-detail.tsx)'s
`AddProduct` used `MoneyInput`, which takes a `number` and seeds its text with
`value.toFixed(2)` — so an unset price is unavoidably "0.00" in the box.

[money-input.tsx](../../../apps/workbench/components/money-input.tsx) already
knew this and already carried the answer: `MoneyTextInput` exists a few lines
below, documented as the one to use when an amount "can be left blank and mean
none", because "0 and 'not set' are different answers". `AddProduct` reached for
the wrong one of the two.

The header comment on `MoneyInput` even anticipates the shape of it — "clearing
the field to retype would snap back to 0.00 under the cursor" — but solves it for
editing an existing amount, not for a form that opens with none.

## The fix

The new-product form now holds its price as TEXT, starting empty:

- `MoneyTextInput` instead of `MoneyInput`, so the box is genuinely empty and a
  click-and-type replaces nothing.
- The price is **required**, like the code is — `moneyProblem` for unreadable
  text, "Give the product a price." for blank — and **Add product** is disabled
  until it reads. That closes the $0.00 half as well.
- The error stays hidden while the box is empty, following the same discipline
  the code field already used: the form does not open by telling somebody off.

Applied piggles RULE #0.5 on the way past. `AddProduct` moved out of the
817-line `product-detail.tsx` into `product-add.tsx` plus `product-add-fields.tsx`,
both under 250. `product-detail.tsx` is down to 548 and its `ManageProduct` half
is still over — noted rather than done, because that is a refactor of the whole
product surface rather than a repair to this field.

**Checked on the siblings.** `MoneyInput` is used at 20-odd other call sites.
Every one of them edits an amount that already exists (an invoice line, a tier
price, a rule threshold), where the value in the box IS the answer and appending
to it is understandable. This form was the one place the box opened holding a
number nobody had entered.

## Confirmed by

**Added her second product as Devi, on the same screen.**

The Price box now opens **empty**, with a pale left-aligned `0.00` that is a real
placeholder — checked in the DOM as well as by eye, because "looks empty" was the
whole problem the first time.

Typed the name `Sunday Trouser, wide leg`, clicked once at the LEFT of the price
box — the same click that produced 128000.00 — and typed `110.00`. The box read
**110.00**. Saved, and the database agrees:

```
 title                    | sku            | price_cents
 Sunday Trouser, wide leg | SUNDAY-TROUSER |       11000
```

**The required half, checked too.** Cleared the price and tabbed away with a name
and a code both filled: **Add product** greyed out and stayed disabled
(`button.disabled === true`), so a shop can no longer be filled with free things
by pressing it. No red message appeared while the box was merely empty, which is
the discipline the code field already had.

The Ash Overshirt kept the $128.00 it was given before the fix, on all fifteen of
its versions — nothing was disturbed by the change.

## Rating effect

`Sell › Add a product` — recorded in [rating.md](../rating.md).
