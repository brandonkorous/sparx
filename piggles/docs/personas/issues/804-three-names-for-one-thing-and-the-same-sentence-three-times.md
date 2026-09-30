# 804 — Three names for one thing, and the same sentence three times

**Status:** fixed
**Severity:** low
**Found by:** P03 · Juniper Row · act 280
**Surface:** mypiggles + sparx workbench — `commerce.product-types.list`, `commerce.product-types.detail`
**Filed:** 2026-09-24
**Blocked on:** —

## Three names for one thing

Issue 798 gave these screens one word for a kind of product and one word for the
details it carries. The machine key underneath still had three:

```
list, column header   Key
list, search box      Name or id…
detail, field label   Id
```

Now all three say **Id**, which is the word CMS content types already use for
the same idea ("Field id"). Changing it to something plainer is a console-wide
question and is not settled here — but a screen may not spell it three ways.

## The same sentence three times

The Apparel kind carries five details, three of them Long text, and the list of
them read:

```
Fabric & construction  fabric     Long text
  Several lines of plain writing, with no formatting.
Fit                    fit        Long text
  Several lines of plain writing, with no formatting.
Care                   care       Long text
  Several lines of plain writing, with no formatting.
```

The row was drawing the description of the KIND of field. Each of those three
details carries its own sentence, written for whoever fills the box in, and the
row had it in hand:

```ts
helpText: "What it's made of and how it's built. This is product-specific. …";
helpText: "How it's cut and how it wears (relaxed, true-to-size, compressive).";
helpText: 'Washing and care instructions.';
```

The editor showed it once you expanded the row. The list of rows, which is what
a person reads first, showed the generic line instead — another instance of
[[feedback_fetched_but_never_rendered]].

**Fixed:** the row prints the detail's own words, and falls back to the kind's
description only where there are none. It is a BLANK test, not a null one, so a
help text emptied to `''` falls back the same as a missing one.

```
Fabric & construction  fabric     Long text
  What it's made of and how it's built. This is product-specific. Write it per product.
Fit                    fit        Long text
  How it's cut and how it wears (relaxed, true-to-size, compressive).
Care                   care       Long text
  Washing and care instructions.
Materials              materials  Repeating group
  A group filled over and over: spec rows, materials, ingredients.   ← no helpText, so the kind
```

## The row at 360px

Giving the rows real sentences exposed the next thing: docked at 360px the three
icon buttons held their ~110px and the sentence was left about 150, so two lines
became six beside a column of empty space. The row wraps now (`flex-wrap` plus a
`min-w-48` floor on the text, the same fix as issue 803), and the buttons drop
to their own line, right-aligned.

## And one word that should not have been there

The built-in **Auto Part** kind described itself:

> Vehicle parts: **fitment**, specifications, and warranty.

"Fitment" is the word this console renames away from on every screen. One of the
seven built-ins; the other six were already plain. Now "Vehicle parts: what they
fit, specifications, and warranty."

That string is authored in `commerce-schemas` and reaches a database through
`seedBuiltInProductTypes` in the deploy's data stage — the mechanism issue 604
built for exactly this. So the edit ships with the code and needs no migration,
but the row on any already-seeded database keeps the old sentence until the next
deploy runs the seed. The local database still reads "fitment" for that reason.

## Files

- `piggles|sparx/apps/workbench/surfaces/commerce/product-types-list.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/product-type-detail.tsx`
- `wizeworks/packages/commerce-schemas/src/product-types/builtins/auto-part.ts`
