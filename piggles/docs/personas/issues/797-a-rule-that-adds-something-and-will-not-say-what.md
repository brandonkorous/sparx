# 797 — A rule that adds something to the order and will not say what

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 280
**Surface:** mypiggles + sparx workbench — `commerce.configurator-template.detail`, `commerce.product.configurator`
**Filed:** 2026-09-24
**Blocked on:** —

## What happened

A build's rules are printed as sentences, so the person who wrote them can read
them back. Every kind of rule names what it touches:

```
When Size is Large, Monogram must be answered.
When Size is Large, Gift wrap is not asked.
When Size is Large, the price changes by +$5.00.
```

Except the one that puts something in the order:

```
When Size is Large, an extra is added to the order.
```

It names nothing. Two builds, one adding a gift box and one adding three
shipping protectors, print that same sentence word for word, and no screen in
the console will tell her which. A second rule in the same list reads:

```
When Size is Small, the price changes by nothing.
```

That is a sentence about a rule that does nothing, written as though something
had happened.

## Why

The action carries both facts:

```ts
| { kind: 'add_addon'; variantId: string; quantity: number }
```

and the build it belongs to already holds the name:

```ts
export interface ConfiguratorAddOn {
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;   // <- fetched on every load, drawn nowhere
  ...
}
```

The sentence threw both away. The build editor went further and stripped the
names out on the way into its own draft, keeping only the three fields the
server wants back — so by the time the rules were printed, the name was gone
from the page that had just downloaded it.

The price line read `deltaLabel(...) ?? 'nothing'`, and `deltaLabel` returns
null for zero as well as for absent.

## The reason it survived

`ruleSentence` existed **four times**, byte for byte: the product's build panel
and the full build editor, in each of the two consoles. Confirmed by hash:

```
piggles/product-configurator            df0d119ccbe1174f9199cab1dfb081da
piggles/configurator-template-detail    df0d119ccbe1174f9199cab1dfb081da
sparx/product-configurator              df0d119ccbe1174f9199cab1dfb081da
sparx/configurator-template-detail      df0d119ccbe1174f9199cab1dfb081da
```

`deltaLabel` was a fifth, sixth, seventh and eighth copy. Act 279 spent a pass
on exactly this shape (issue 793: a picker built beside one pane reached one
pane), so this was fixed by deleting the copies rather than by editing four of
them.

## What was done

`ruleSentence`, `deltaLabel` and a new `addOnWords` now live in
`products-data.ts`, which both panes in both consoles already import their other
build words from. All four local copies are gone.

The sentence names the extra and counts it:

```
When Size is Large, the order gets Gift box.
When Size is Large, the order gets 3 of Gift box.
When Size is Large, the price is left alone.
When Size is Large, the price is left alone (No charge).
```

It falls back to "an extra" / "2 extras" when the build carries no title for the
variant, which is the honest thing to say rather than a SKU — the same call
issue 182 made on the bundle rows.

To make that possible, both panes now carry the add-ons as the server sent them,
names and all:

- the build editor holds `ConfiguratorAddOn[]` and maps down to the wire shape
  at save time, through a new `addOnInputs()`;
- the product's build panel carries them read-only and leaves them out of its
  save payload, which `configurator-service.ts` reads as "leave them alone"
  (`if (input.addOns)` — verified, not assumed; an absent key preserves them).

## Proof

`surfaces/commerce/build-rule-words.test.ts`, 8 cases, in both consoles. Proved
red first by putting the two old sentences back: **6 of 8 failed**, and the two
that passed are the ones that never depended on the fix.

## Files

- `piggles|sparx/apps/workbench/surfaces/commerce/products-data.ts`
- `piggles|sparx/apps/workbench/surfaces/commerce/configurator-template-detail.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/product-configurator.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/build-rule-words.test.ts` (new)
