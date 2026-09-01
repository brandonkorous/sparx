# 338 — The words she wrote for blind shoppers were used on one page only

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · scoring her published site (RULE #8)
**Surface:** the published site › the shop, the home page, search, collections
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** her live shop grid, which now reads her sentences aloud; two integration tests, red before green

## What happened

Devi wrote a description for each of the three photographs she uploaded. The
field asks for it plainly, and the console makes a plain promise underneath:

> **Description for screen readers**
> Read aloud to shoppers who cannot see the picture, and shown if it fails to
> load. Describe what is in it, not that it is a photo.

No qualification, no "on the product page". Reading the alt text off her live
shop, all seven cards:

```
Silk twill scarf
Marlow Knit
The Everyday Tee
Linen Shirtdress
The Ash Overshirt
Sunday Trouser, wide leg
Leather-covered belt
```

Every one is the product title, which is already the heading printed directly
beneath the picture. Open the Linen Shirtdress itself and her sentence is there:

> The Linen Shirtdress in Chalk, buttoned through with the belt tied at the
> waist, worn against a wall of ivy.

So the words she wrote were used on the one page a shopper reaches LAST, and
nowhere on the pages that get them there.

## What should have happened

The description is read wherever the photo is shown.

## Why it matters

**The promise is unconditional and it was kept once.** She was told the sentence
is read aloud to shoppers who cannot see the picture. On the shop grid, the home
page rails, the search results and every collection, it is not.

**Those are the pages where most photographs are seen.** A shopper browsing a
seven-product shop meets seven pictures on one screen and opens maybe one. The
page that honored her writing is the page she has already decided on.

**Announcing the title is worse than announcing nothing.** The card is a single
link wrapping the picture and the name, so its accessible name was
_"Linen Shirtdress Linen Shirtdress $145.00"_ — the title twice. Her sentence
replaces the duplicate with the thing a person actually needs: what the garment
looks like.

## Where it lives

Two selects in one file, disagreeing — the same shape as [337], and found on the
same product.

[commerce.ts](../../../../wizeworks/services/api-rest/src/routes/v1/public/commerce.ts):

```ts
// the LIST/card select — line ~1232
images: {
  where: { variantId: null },
  orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
  take: 1,
  select: { mediaAssetId: true },        // the id, and nothing else
}

// the product DETAIL select — line ~1370
images: {
  orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
  select: { id: true, mediaAssetId: true, variantId: true, alt: true, … },
}
```

and the same disagreement again downstream, sixty lines apart in one file —
[silica-data.ts](../../../../wizeworks/apps/site/lib/silica-data.ts):

```ts
// toSilicaProduct — the card
image: { url: url ?? '', alt: p.title },

// productToSilicaRecord — the product page
image: { url: url ?? '', alt: primary?.alt ?? p.title },
```

**The card could not have done better.** `PublicProductListItem` carried
`primaryImageId` and no alt at all, so the renderer had nothing to render. This
is not a call site that chose the title; it is a query that never asked.

## The fix

`alt` travels with the thumbnail, and the three card renderers use the same
ladder the product page has always used — her sentence, else the product title:

```ts
select: { mediaAssetId: true, alt: true },
…
primaryImageAlt: row.images?.[0]?.alt ?? null,
```

- [silica-data.ts](../../../../wizeworks/apps/site/lib/silica-data.ts) — the live
  card path for every published site
- [product-card.tsx](../../../../wizeworks/apps/site/components/product-card.tsx) —
  the React tile
- [builder-data.ts](../../../../wizeworks/apps/site/lib/builder-data.ts) — the
  legacy builder source

**Deliberately NOT falling back to the media asset's own `altText`.** The console
gallery does (`image.alt ?? asset.altText ?? …`) and that is right for an admin
thumbnail, but the asset description describes the FILE, and a file can hang on
several products. This tenant proves it: the belt's only photograph is a library
row whose description reads _"A tan vegetable-tanned leather tote bag."_ Adding
that rung would have had her shop announce the belt as a tote. Where she has
written nothing, the product name is the honest answer, and it is the one the
product page already gives.

## Confirmed by

Her live shop, re-read after the change — the three she described now announce
her own sentences, and the four she has not keep their names:

```
Silk twill scarf
The Marlow Knit in Oat, an undyed flecked lambswool crew, held up against a pale studio wall.
The Everyday Tee
The Linen Shirtdress in Chalk, buttoned through with the belt tied at the waist, worn against a wall of ivy.
The Ash Overshirt in Bone, an off white corduroy with a collar and patch pockets, worn open over jeans.
Sunday Trouser, wide leg
Leather-covered belt
```

`product-card-alt.test.ts`, two tests through the real HTTP routes rather than
against a hand-built row — a mapper reading a field the query never asked for
returns `undefined` and passes a unit test happily. Proved red first: with
`alt: true` removed from the select, the first fails on `expected null to be 'A
bone corduroy overshirt…'`. Restored, both pass.

The second test is the one that will still be earning its keep in a year: it
pins that a photo with no written description returns **null**, not the library's
description of the file.

## Rating effect

Against `P03 site — Juniper Row`, scored for the first time in this pass.
