# 276 — Every aisle in her shop led to an empty room

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · RULE #8 — following her own category links as a
shopper
**Surface:** the tenant site — `/category`, `/category/{handle}`,
`/collections/{handle}`
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

`juniperrow.com/category` is a real page with a real heading — "Categories.
Browse everything at Juniper Row." — and six cards under it, each with a
description someone wrote:

```
Apparel
Goods         Everyday goods — the whole shop in one place.
Knitwear      Sweaters and layers in good wool.
Outerwear     Coats and heavier layers.
Tops          Tees and shirts.
Trousers      Tailored and relaxed cuts.
```

**Every one of them led to a page with nothing on it.** Eighteen categories, all
live, all empty — and each said the same thing when you got there:

> 🔍 **No products found**
> Try adjusting your filters or search.

over a filter panel with nothing selected.

## Why it was empty

Her categories came with the blueprint, and so did the sample products filed in
them. She deleted the samples weeks ago — correctly, they were somebody else's
stock. The categories stayed, still featured, still linked, now holding fifteen
links to deleted rows.

Nothing anywhere said so. The console's category list showed eighteen
categories; the site showed six cards; the API answered 200 for all of them. The
only place the truth existed was a join nobody rendered.

## Three separate things were wrong

**1. The empty state gave advice that could not be taken.** "Try adjusting your
filters or search" is right for a shopper who narrowed a listing and found
nothing. It is useless to a shopper standing in an empty aisle, and it sends
them hunting for a control they never touched. Same sentence on
`/collections/last-chance`, which has been empty for the whole run.

**2. The index advertised the empty aisles.** `CategoryIndex` listed every root
category regardless of whether anything was under it, so her shop's front door
to browsing was six doors and five dead ends.

**3. The sitemap knew nothing about categories at all** — that half is
[275](275-every-url-in-the-sitemap-had-two-slashes.md).

## The fix

**Two empty states, not one.**
[browse-empty.tsx](../../../../wizeworks/apps/site/components/products/browse-empty.tsx)
splits on whether the VISITOR narrowed anything — a search term, a facet, a
price, stock, a fitment choice. The collection or category a page is scoped to
deliberately does not count: that is the page they opened, not a choice they can
take back, and offering to clear it is offering to leave.

```
narrowed     Nothing matched
             Nothing here fits what you asked for. Try removing one of your choices.
             [ Clear and show everything ]

empty        Nothing here yet
             This part of the shop is empty at the moment. There is more in the shop.
             [ Browse the shop ]
```

**The index shows aisles with something in them.** `/v1/public/commerce/categories`
now returns `hasProducts`, rolled up by `path` prefix exactly the way the
category page rolls its products up — so a parent whose products all sit in its
children still shows, and the index can never hide a category whose page has
something on it. A `groupBy` rather than a row list, so it stays one row per
category however big the catalog is. The storefront treats a MISSING field as
"show it", so an older api-rest behaves as it always did instead of emptying the
page.

## Her site

Devi filed all seven products, through the product editor's own picker. The
picker is good — it says the thing that matters before you have used it:

> Not filed in any category yet — shoppers browsing your menu will not come
> across it.

```
Apparel        7        Accessories    2        Tops        2
Outerwear      1        Knitwear       1        Trousers    1     Belts   1
```

`/category` now shows five aisles and every one of them has clothes in it.
"Goods" — "Everyday goods — the whole shop in one place", on a womenswear label
— is gone from the index and out of the sitemap, without anything being deleted.

## Also seen, not fixed

**Every card on the category index wears a "Featured" label above its heading.**
All six had it, which means it separates nothing. Left alone: this is a TENANT
SITE surface, where the console's no-eyebrow rule deliberately does not reach,
and it is a design call on a page whose owner can restyle it.

**The category picker's search drops the ancestry.** Unfiltered it reads
`Apparel › Accessories`; typing narrows some rows to the bare leaf. With a tree
that has `Apparel › Clothing › Men` and could have `Kids › Men`, the path is
what tells them apart.

## Related

Same shape as [266] and [263]: blueprint content that outlives the reason it was
installed, still serving under the business's name.

[[feedback_never_present_absence_as_measurement]] — "No products found. Try
adjusting your filters" over no filters is a measurement of a search nobody ran.

## Rating effect

The tenant site's browse surfaces, and the product editor's category picker, in
[rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
