# 221 — Five identical rows, and no way to tell which was the M

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 7
**Surface:** the product picker, shared by returns, bundles and the configurator
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 7, on screen, M · Slate picked out of five

## What happened

Settling Anneliese's exchange asks which version is going out. Devi typed
`slate` and got this:

```
The Ash Overshirt                              $128.00
The Ash Overshirt                              $128.00
The Ash Overshirt                              $128.00
The Ash Overshirt                              $128.00
The Ash Overshirt                              $128.00
```

Five rows, one product, identical to the character. They were XS, S, M, L and
XL in Slate, and **nothing on the screen said so.** The only way to send the
right one was to guess.

## What should have happened

`M · Slate`.

## Why it matters

Picking the wrong row here means posting an XS to somebody who ordered an M —
the exact mistake the return exists to correct, made again by the screen that
was supposed to correct it. And it is not recoverable by looking harder: the
five rows are the same pixels.

**The picker was already holding the answer.** `VariantChoice.options` carries
the option values, and its own comment in the data file says why:

> The option values that make this version the one it is… **What actually tells
> two rows apart when `title` is blank, which on a seeded catalog is always
> (issue 182).**

The field was added for this, documented for this, fetched for this — and the
row never read it. It is the commonest defect shape in this codebase and the
same one as
[216](216-the-follow-up-list-would-not-say-who-to-follow-up.md): the value was
already in the component's hand and nothing drew it.

The search made it worse in a quiet way. Typing `slate` MATCHED — on the SKU,
which is also not shown. So the filter proved the rows differed and the list
refused to say how.

## Where it lives

[variant-picker.tsx](../../../../piggles/apps/workbench/surfaces/commerce/variant-picker.tsx):

```tsx
{
  !variant.isDefault && variant.title ? (
    <Text as="span" className="block text-sm">
      {variant.title}
    </Text>
  ) : null;
}
```

`title` is null on every variant this catalog has, so the second line never
rendered at all. `options` was never referenced.

## The fix

**A version is named by whatever actually distinguishes it**, in order of what a
person would recognise: the title a shop wrote, else the option values, else the
code. Nothing at all only for a product with one unnamed version, where a second
line would just repeat the first.

The search learned the same vocabulary — `slate` and `medium` are what a person
types, and on a catalog with no variant titles they live nowhere else.

This is a SHARED picker: bundles and the configurator were choosing components
out of the same wall of identical rows.

## What it looked like once fixed

```
The Ash Overshirt                              $128.00
L · Slate
The Ash Overshirt                              $128.00
M · Slate
The Ash Overshirt                              $128.00
S · Slate
```

and the button that commits it reads **Send M · Slate**, not "Send".

## Rating effect

Recorded in the run log of [03-juniper-row.md](../03-juniper-row.md). Found only
because [220](220-an-even-exchange-could-only-be-ended-by-refunding-it.md)'s fix
put a picker in front of a person who had to choose correctly.
