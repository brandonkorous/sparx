# 689 — Two buttons that did nothing when the box was empty

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 242
**Surface:** mypiggles — Making things › Recipes › a new recipe
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen
**Blocked on:** —

## What happened

Devi opened a new recipe. The first field is **Product code**, with a button
beside it reading **Find it**.

She does not know her codes by heart, so she pressed the button labelled "Find
it" before typing anything. Nothing happened. No error, no hint, no movement, no
toast. She pressed it again. Still nothing.

The **Add** button under "What goes into it" behaves the same way.

## Why

```ts
const setOutput = () => {
  const sku = outputSkuEntry.trim();
  if (sku === '') return;
```

and, forty lines up:

```ts
const addComponent = () => {
  const sku = skuEntry.trim();
  if (sku === '') return;
```

Both guards are correct and both are silent. A control that works when it holds a
value and is dead when empty is the shape in
[[feedback_the_empty_control_is_the_untested_one]]: seeded fields work, the ones
that open empty do not, and nobody notices because nobody drives an input from
empty.

The label makes it worse. "Find it" reads as a search — help me find the thing —
when what it does is resolve a code you already know. Pressed empty by somebody
taking the label at its word, it is silence.

## What changed

Both buttons are disabled while their box is empty. A disabled control prevents
the dead press rather than scolding after it, and the required marker plus the
placeholder already say what the box wants. The early `return` stays as a guard
for the Enter key.

## What was NOT changed, and why

The obvious next move is to replace the code box with `VariantPicker`, the shared
component five sibling screens already use, which searches by product name.

It was not done, because the picker reads `/v1/commerce/variants`, which is
SITE-SCOPED — deliberately, since 2026-09-17, after tenant-wide reads "put one
business's stock in another one's till". `lookupVariantBySku`, which this screen
uses, is tenant-wide.

So the two are not interchangeable, and swapping one for the other silently
changes which of a tenant's businesses a recipe can be built from. MEASURED
2026-09-19: Juniper Row has **42 products pinned across 6 sites**, so the
difference is live for this persona, not theoretical.

Which one is right for a recipe is a real question and the data model does not
settle it: `inventory_bills_of_materials` is keyed on `(tenant_id,
output_variant_id)` with no `property_id`, while the output product it points at
IS site-scoped. Worth deciding on purpose rather than by picking whichever
component was nearest.

## Confirmed

Both buttons render faded and unclickable on an empty box, and enable on the
first character typed.

## Files

- `piggles|sparx/apps/workbench/surfaces/inventory/bom-detail.tsx`
