# 182 — Ten identical rows, and she has to guess which size

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · [026] walk-through
**Surface:** mypiggles › Sell › Take a sale — "What they had"
**Filed:** 2026-08-24
**Fixed:** 2026-08-24
**Confirmed by:** P03 · Juniper Row · 2026-08-24
**Blocked on:** —

## What happened

Devi stands at her counter, searches her own catalog for the knit somebody is
buying, and gets this:

```
Marlow Knit    $96.00
Marlow Knit    $96.00
Marlow Knit    $96.00
Marlow Knit    $96.00
Marlow Knit    $96.00
Marlow Knit    $96.00      ← and four more below the scroll
```

Ten rows. Identical name, identical price, nothing to tell them apart. They are
the ten versions of the garment — XS/S/M/L/XL in Oat and Moss — and the list
gives her no way to know which row is which.

Linen Shirtdress does the same thing. So does every product with versions.

## Why it matters

This is the till. Someone is standing in front of her. She picks a row, and
whichever one she picks is what the order says was sold — the SKU on that line is
what tells her which garment to take off the rail, what comes out of stock, and
what the customer collects.

So a wrong guess is not a cosmetic mistake. It is the wrong size in the bag,
stock decremented against the wrong version, and a customer who finds out at home.
Ten identical rows make that a **one-in-ten guess** on every sale of a garment
that comes in sizes, which for a clothing label is nearly every sale.

The order pane knows perfectly well which one it was — it prints `MARLOW-KNIT`
under the line. The information exists on both sides of the transaction. It is
missing only at the moment of choosing.

## Where it lives

The list row already renders a detail line, and it is not the renderer's fault —
[sale-lines.tsx](../../../apps/workbench/surfaces/commerce/sale-lines.tsx) draws
`item.detail` whenever there is one:

```tsx
<span className="block font-medium">{item.name}</span>;
{
  item.detail ? (
    <Text as="span" className="block text-sm">
      {item.detail}
    </Text>
  ) : null;
}
```

The value is what is missing.
[sale-data.ts](../../../apps/workbench/surfaces/commerce/sale-data.ts) builds it as:

```ts
detail: v.isDefault ? null : v.title,
```

and every variant's `title` is empty:

```
sku                  | title | is_default
MARLOW-KNIT-XL-MOSS  |       | f
MARLOW-KNIT          |       | t
MARLOW-KNIT-XS-MOSS  |       | f
MARLOW-KNIT-S-OAT    |       | f
…
```

The distinction is real and recorded — it is in the **SKU**, and structurally in
`commerce_product_variant_option_values` (Size = XL, Color = Moss). `title` is
simply not where this catalog keeps it, and the till reads only `title`.

This is the [[feedback_fetched_but_never_rendered]] shape with one turn added:
the field is fetched, the renderer is willing, and the field it reads is the one
field that happens to be blank.

## The fix

Two parts, and the first is not enough on its own.

1. **Fall back to something that distinguishes.** When `title` is blank, the SKU
   is right there on `Sellable` and is already how a maker identifies a garment
   on a rail. `MARLOW-KNIT-L-OAT` under the name is instantly usable.
2. **Prefer the option values when they are available.** "L · Oat" is what she
   would say out loud; a SKU is what she would read off a label. If
   `/v1/commerce/variants` can carry the resolved option values, that is the
   better detail line and the SKU is the fallback beneath it.

Whichever lands, the rule underneath is: **a picker must never render two rows
that a person cannot tell apart.** If the distinguishing field is empty, fall
through to one that is not.

## How to reproduce

Every time.

1. Sell › Take a sale.
2. Search for any product that has versions (Marlow Knit, Linen Shirtdress).
3. Count the rows. Try to work out which one is the large.

## Rating effect

`Sell › Take a sale` is scored in [rating.md](../rating.md).

## Fixed — 2026-08-24

**The endpoint now returns the lattice point.** `/v1/commerce/variants` selects
each variant's `optionAssignments` and emits them as an ordered `options` array,
sorted by the shop's own option position and then value position — so every
variant of a product reads its axes in the same order ("L · Oat", never
"Oat · L"). One join, on a list the till already fetches.

**The till reads a ladder, not a field.** `variantDetail` in `sale-data.ts`:

1. the option values as she would say them out loud — `L · Chalk`;
2. else the variant's own `title`, for a catalog that does name its versions;
3. else the **SKU**, which is how a maker identifies a garment on a rail;
4. null only for the default version of a single-version product, where there is
   genuinely nothing to distinguish it from.

The rule underneath, which is the part worth keeping: **a picker must never draw
two rows a person cannot tell apart.** If the distinguishing field is empty, fall
through to one that is not — never render the ambiguity.

### Confirmed on screen

Take a sale, searching her own catalog, now reads:

```
Leather-covered belt                    $72.00
Linen Shirtdress    L · Chalk          $145.00
Linen Shirtdress    L · Indigo         $145.00
Linen Shirtdress    M · Chalk          $145.00
```

Every row distinguishable, in her option order.

### A note for whoever meets this again

`ProductVariant.title` is documented in the schema as "computed from options when
omitted", and nothing computes it — every seeded variant carries an empty string
rather than a null or a summary. That is worth fixing at the source one day, but
the till should not have depended on it either way: the option values are the
fact, and `title` is a cache of them.
