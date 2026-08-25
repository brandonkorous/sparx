# 197 — Every photo on her website was announced as "Product image"

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 4
**Surface:** the tenant's website — every product page, card and rail
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 4, on screen

## What happened

Devi wrote a description for every photograph she uploaded, in the field that
tells her exactly what it is for:

> Read aloud to shoppers who cannot see the picture, and shown if it fails to
> load. Describe what is in it, not that it is a photo.

Seven sentences across three products. Not one of them reached her website. Every
image on every page announced itself as **"Product image"**.

```
Linen Shirtdress, before:  alt="Product image" ×3
```

## What should have happened

The sentence she typed is the sentence a screen reader says.

## Why it matters

It is not a cosmetic failure — it is the platform asking for work and then
throwing it away, on the one surface where the person who needs it cannot see
that anything is wrong. A blind shopper hears "Product image, product image,
product image" on a page selling three colorways of the same dress, and has no
way to tell them apart. Search engines read the same string.

Devi is a small-batch maker whose product IS the photograph. The console told her
this field mattered, she filled it in for every picture, and the site said
"Product image".

It affects **every tenant on the platform**, not this shop: no bound image
anywhere has ever carried a real description.

## Where it lives

Not the console and not the database. The console saved every sentence and the
API returned them — the record reaching the page is
`image: { url, alt: 'The Linen Shirtdress in Chalk, …' }`.

**A silica node carries at most one `data` marker, structurally.** So an image
binds its `src` OR its `alt`, never both, and `src` has to win. The value arrives
as an object holding both, the host formatter unwraps the url, and the alt is
dropped one line before anything could use it:

```ts
// builder-schemas/src/silica-resolve.ts, defaultSilicaFormat
if (value && typeof value === 'object' && 'url' in value) {
  const url = value.url;
  return typeof url === 'string' && url ? url : undefined; // ← alt, gone
}
```

The catalog then supplies its stand-in — `alt: 'Product image'` — and that is what
ships. This is the same shape as six earlier findings in these runs: **a value
already in the component's hand that nothing draws.**

## The fix

A derivation, not a second binding, because a second binding is not expressible.

1. **The resolver keeps what it is about to drop.** `createSilicaResolver` now
   carries `imageAlts: Map<url, alt>`, filled as bindings resolve. It is the one
   place both the builder canvas and the storefront see the object whole, so
   there is no second copy to keep in step.
2. **A render stage writes it back.**
   [image-alt.ts](../../../../wizeworks/packages/silica-catalog/src/image-alt.ts)'s
   `fillImageAlt` walks the resolved tree and gives every image the sentence its
   record carried. Same shape as `responsiveImages` beside it, and for the same
   reason: the value only exists AFTER resolution, so it can be neither authored
   nor bound.
3. **It goes in `finalizeTree`, which is the whole point of that function.** All
   three render paths — the HTML projection, the React chrome, the functional body
   — call it, so none of them can be the one that misses this. Both times a stage
   was added anywhere else, one path silently went without it.

An alt somebody **typed into the builder** outranks the record and is left alone;
only the generic stand-ins (`Product image`, `image`, `photo`, `picture`, empty)
are replaced.

### The near-miss worth recording

The first version matched the node's `src` against the map key as whole strings,
and matched **nothing**. Both sides carry a query and neither's is the other's:
the record's url arrives signed (`?tenant=juniper-row`) and `responsiveImages`
appends a width. It looked like it worked — because a miss is silent and the
fallback is the same words the bug produced. Only checking the rendered `alt` on
the real page caught it. Both sides are now keyed on the url without its query,
with a test that fails if either side's query comes back.

## What it looked like once fixed

The Linen Shirtdress page, read out of the live DOM:

```
"The Linen Shirtdress in Chalk, a warm off white, buttoned through with the
 belt tied at the waist."
"Marlow Knit"
"The Ash Overshirt"
```

Her sentence on the hero; the two cross-sell cards keep the product name, which
is the right description for a card.

## The neighbour check

The resolver and the render pipeline are shared spine, so per personas RULE #7 an
earlier business was reopened afterwards: **Thistle & Rye** (P01) still renders its
chrome, hero, collection tiles and category cards unchanged.

## How to reproduce

Before the fix, on any tenant:

1. Sell › Products › any product › Media › write a description on a photo, save.
2. Open the product on the website.
3. The image's `alt` is `Product image`.

## Rating effect

`Sell › Product › Media` in [rating.md](../rating.md), and the website itself —
personas RULE #8 says the website is the deliverable, and this was the website
discarding her work.
