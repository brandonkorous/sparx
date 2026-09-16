# 484 — A shipping charge she typed as 25.00 was saved as 201.00

**Status:** fixed
**Severity:** major
**Found by:** Devi putting the carriage on her first purchase order
**Surface:** `inventory.purchase-orders.detail` · `finance.expense.detail` (both consoles)
**Filed:** 2026-09-09

## What was wrong

She selected the whole Shipping cost field, which held `0.00`, and typed
`25.00`. The field settled on **`201.00`**, and the order total went from
$720.00 to $921.00. Nothing said anything.

Keystroke by keystroke, with the whole field selected:

| she types | field holds | caret                         |
| --------- | ----------- | ----------------------------- |
| `2`       | `2.00`      | at the end, past the decimals |
| `5`       | `2.01`      | at the end                    |
| `.00`     | `201.00`    | —                             |

The first keystroke replaced the selection with `2`, the field reformatted it to
`2.00` and put the caret behind the cents; every later digit landed in the cents
column and was rounded away.

## Why

`MoneyTextInput` exists so a money field can hold **exactly what was typed while
it is being typed**. Its whole contract is that the caller owns the text. This
call site owned CENTS and rebuilt the text on every render:

```tsx
<MoneyTextInput
  text={centsToInput(draft.header.shippingCents)}
  onTextChange={(text) => {
    setHeader('shippingCents', moneyCents(text) ?? 0);
  }}
/>
```

Type `2` → `moneyCents('2')` is 200 → `centsToInput(200)` is `"2.00"` → that is
handed straight back as the field's value. The person's text never survives one
keystroke.

**The right component was two fields away.** `MoneyInput` takes a NUMBER, keeps
the text to itself, tracks outside changes only while unfocused, and selects the
contents on focus — with a comment naming this exact failure: _"a caret dropped
in front of it turns 9.00 into 9.000.00 — a delivery charge, or a price, a
thousand times over (issues 169 and 205)"_.

Four call sites had the same shape, two per console:

- `inventory/purchase-order-detail` — Shipping cost
- `finance/expense-detail` — the amount charged to each record a cost is split across

## The fix

`MoneyInput`, which is the component for an amount the model holds as a number.

## Proven

Selected the field and typed `25.00`: the field reads `25.00`, the order total
reads **$745.00**, and one click now selects the whole amount so there is nothing
to type in front of.
