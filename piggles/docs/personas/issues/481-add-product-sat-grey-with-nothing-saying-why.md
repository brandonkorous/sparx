# 481 — Add product sat grey and nothing on the form said why

**Status:** fixed
**Severity:** major
**Found by:** Devi adding linen to her catalogue so she could put it on a purchase order
**Surface:** `commerce.product.detail` (new) — piggles
**Filed:** 2026-09-09

## What was wrong

She opened New product, typed a name, and the code filled itself in. **Add
product stayed grey.** Nothing anywhere on the form said what was missing.

The missing answer was the price. The form knows that — `priceError` holds the
sentence "Give the product a price." — and it was written so the sentence could
never appear:

```ts
const priceError = price.trim() === '' ? 'Give the product a price.' : moneyProblem(price);
...
const shownPriceError = price.trim() === '' ? null : priceError;
```

The only branch that returns the required-ness message is the branch that is
suppressed. **The string is dead in the UI**: when the field is empty it is
hidden, and when the field is not empty `priceError` is `moneyProblem(price)`
instead. It exists solely to keep the button disabled.

## The code beside it already had the answer

`shownSkuError` uses a different rule:

```ts
const started = trimmed !== '' || touchedSku;
const shownSkuError = started ? skuError : null;
```

"Silent until the form has been started, then say what is still missing." That
is the right rule, it is documented in a docblock four lines above, and the
price was held to a different one.

## And nothing said the fields were needed, either

Name, Price and Product code are all required, and none carried the required
asterisk. **Twenty-one panes in this console use `<FieldLabel required>`** —
including the purchase-order line editor and the supplier form Devi had used ten
minutes earlier.

## The fix

One rule for both fields, plus the asterisk on all three:

```ts
const started = trimmed !== '' || touchedSku || price.trim() !== '';
const shownSkuError = started ? skuError : null;
const shownPriceError = started ? priceError : null;
```

The asterisk says which answers are needed before anything is typed; the field
message says what is still missing after. Neither speaks first.

## Proven

Opened New product: asterisks on Name, Price and Product code, no red anywhere.
Typed "Brass belt hardware, antique": **"Give the product a price."** appeared
under Price, which is the whole reason Add product was grey. Filled it in and
the button came alive.
