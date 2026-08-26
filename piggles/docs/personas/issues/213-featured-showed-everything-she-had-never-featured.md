# 213 — "Featured" showed everything, and she had featured nothing

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 5
**Surface:** the tenant's website — the home page's Featured rail, every tenant
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 5, and re-checked on P01 + a third shop

## What happened

Once [212](212-her-homepage-was-live-and-the-editor-said-it-did-not-exist.md)
made her homepage visible, it turned out to be saying the same thing twice:

```
Shop our products
  The Everyday Tee $42 · Silk twill scarf $58 · Leather-covered belt $72 ·
  Sunday Trouser $110 · Marlow Knit $96 · The Ash Overshirt $128 ·
  Linen Shirtdress $145

Featured
  The Everyday Tee $42 · Silk twill scarf $58 · Leather-covered belt $72 ·
  Sunday Trouser $110 · Marlow Knit $96 · The Ash Overshirt $128 ·
  Linen Shirtdress $145
```

Seven garments, then the same seven, in the same order, under a heading that
says somebody picked them. Devi has featured nothing.

## What should have happened

"Featured" means the ones she featured.

## Why it matters

A shopper scrolling that page sees her whole shop, scrolls past it, and sees her
whole shop again. It reads as a broken website — and it is the first thing a
visitor meets.

The word is doing the damage, not the repetition. **"Featured" is a claim that a
person made a choice.** Presenting an unfiltered list as a curated one is the
same failure as presenting an unmeasured value as a measurement, which this run
has now found five times over. Nobody chose these; the page says someone did.

It is sharper now than when the fallback was written, because
[211](211-the-block-that-sells-products-could-only-ever-sell-everything.md) put
that promise into the console in as many words. The source picker's own label for
this binding is **"The ones you have featured"**. A tenant reads that, picks it,
and gets the ones she has not.

## Where it lives

[silica-data.ts](../../../../wizeworks/apps/site/lib/silica-data.ts):

```ts
setAtPath(
  root,
  'commerce.featured',
  bounded(flagged.length > 0 ? flagged : items, 'commerce.featured')
);
```

with the reasoning stated above it: _"newest-few fallback so the rail is never an
empty heading when nothing is tagged yet."_

**That reasoning was sound and is now obsolete.** The hazard it names —
a heading with nothing under it — was fixed separately, by issue 187, which moved
a curation's heading inside `headingRow` so it hides along with the rail:

> A CURATION says nothing when it has nothing to say. Its HEADING goes with it:
> the heading is the thing that turns an empty strip into a visible hole.

Once that landed, the fallback stopped protecting anything and went on doing its
side effect. Two correct fixes, made at different times, that nobody put next to
each other — so the guard outlived the thing it guarded, and the cost moved from
"an empty heading" to "the catalog twice, the second time mislabelled."

Worth naming as a shape: **a fallback is a claim about what happens when the real
answer is missing. When something else starts handling that case, the fallback
does not become harmless — it becomes wrong.**

## The fix

The fallback goes. `commerce.featured` resolves to the products tagged
`featured`, and to nothing else:

```ts
setAtPath(
  root,
  'commerce.featured',
  bounded(
    items.filter((i) => i.tags?.some((t) => t.toLowerCase() === 'featured')),
    'commerce.featured'
  )
);
```

With nothing tagged the rail is empty, and `headingRow` takes the heading down
with it — so the page loses a band it had nothing to put in, rather than gaining
a duplicate.

## What it looked like once fixed

**Threadline** — a 24-product shop on the untouched starter homepage, nothing
tagged featured:

```
Your work, beautifully online.
  [Browse the shop]  [Learn more]

Shop our products
  sparx Insulated Bottle $32 … Linen Blend Woven Scarf $44
  1  2  …  5  Next →

Ready when you are.
```

The Featured band is gone entirely, heading included. The catalog appears once.

**Juniper Row**, where it was found, no longer uses the binding at all — Devi
repointed both bands at real groups while writing her homepage, which is the
outcome the picker exists for:

```
New in            The Ash Overshirt $128 · Linen Shirtdress $145
The core range    The Everyday Tee $42 · Sunday Trouser $110 · Marlow Knit $96
```

## The neighbour check

Shared spine, so per personas RULE #7 an earlier business was reopened.
**Thistle & Rye** (P01) has a fully authored homepage with no featured rail — it
renders exactly as it did, hero through hours and directions, undisturbed.

## Rating effect

None — the storefront is not rated in [rating.md](../rating.md), which covers
console panes. Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
