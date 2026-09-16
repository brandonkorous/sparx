# 489 — The cost form told her off before she typed

**Status:** fixed
**Severity:** minor
**Found by:** Devi opening New cost
**Surface:** `finance.expense.detail` (both consoles)
**Filed:** 2026-09-09

## What was wrong

[479](479-the-form-told-her-off-before-she-typed-anything.md) again, in Money.
The form opens empty, because it is new, and under the very first field, in red:

> **Say what the money was spent on.**

```tsx
{form.description.trim() === '' && !readOnly ? (
  <FieldStatus status="error">Say what the money was spent on.</FieldStatus>
) : (
```

**Amount, in the same card, waits**: `form.amount.trim() !== '' && !amountOk`.
Not empty AND invalid — it says nothing until there is something to be wrong
about. Description could not use that shape, because empty IS its error, and in
the absence of the obvious alternative it fired on sight.

## Measured

A sweep of every `FieldStatus status="error"` in both consoles whose guard is a
bare `=== ''` with no `touched` flag: **two**, one per console, both this field.
479's fix left no others behind.

## The fix

The same `touched` flag 479 used, flipped by the `set()` every field already
calls. The required asterisk on the label stays, so she still knows the field is
needed before she starts.

## Proven

Opened New cost: no red anywhere, asterisks on What was it for, Amount and
Category. Typed a description and the error stayed away; the check still fires
once the form has been started and the field is empty.
