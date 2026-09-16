# 479 — The new-supplier form told her off before she typed anything

**Status:** fixed
**Severity:** minor
**Found by:** Devi opening "New supplier" for the first time
**Surface:** `inventory.suppliers.detail` (both consoles)
**Filed:** 2026-09-09

## What was wrong

The form opens empty, because it is new. Under the very first field, before a
single keystroke, in red:

> **A supplier needs a name.**

Nothing is wrong yet. She has not done anything. The form is telling her she has
made a mistake by opening it.

## The same card gets it right two rows down

**Short code** is required as well, and it waits:

```tsx
{
  form.code.trim() !== '' && !codeOk ? <FieldStatus status="error">…</FieldStatus> : null;
}
```

"Not empty, and invalid" — so it says nothing until she has typed something to be
wrong about. **Name** could not use that shape, because empty IS its error, and
in the absence of the obvious alternative it simply fired immediately:

```tsx
{
  form.name.trim() === '' ? (
    <FieldStatus status="error">A supplier needs a name.</FieldStatus>
  ) : null;
}
```

## And four other forms in the console already had the alternative

`crm/company-detail`, `crm/customer-detail`, `commerce/shipping-zone-detail` and
`b2b/pricing-tier-detail` all render the same component as
`{nameError && touched ? … }`. The pattern existed; this form had not used it.

## The fix

A `touched` flag, flipped by the same `set()` every field already calls, so the
error waits for the first keystroke anywhere on the form. The required asterisk
on the label stays, so she still knows the field is needed before she starts —
which is the honest way to say it.

## Proven

Opened New supplier: no error under Name, asterisks still on both required
fields. Typed two characters into Name and deleted them: the error appears, so
the validation still does its job — it just no longer speaks first.
