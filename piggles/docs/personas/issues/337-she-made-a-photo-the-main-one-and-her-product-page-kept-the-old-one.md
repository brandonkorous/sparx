# 337 — She made a photo the main one and her product page kept the old one

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · replacing three placeholder drawings with real photographs (RULE #8)
**Surface:** the published site › a product page
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** her Marlow Knit page, which now leads with the photograph she chose

## What happened

Three of Devi's products carried flat vector drawings instead of photographs, so
she uploaded a real one to the Marlow Knit, wrote its description, and pressed
**Make it the main photo**. The console agreed: the photo moved to the front of
the gallery and took a green **Main** badge.

Her product page went on showing the drawing.

The Photos tab says, at the top, in her words:

> Shoppers see these in this order. Your main photo always comes first — it is
> the one used in lists, on cards and in search results.

It was not used on the product page at all. Reading the public API directly:

```
pos=0  0eb1ccbf  The Marlow Knit in Oat, an undyed cream lambswool crew, laid flat…   ← the drawing
pos=1  2161e0cb  The Marlow Knit in Moss, a deep grey green lambswool crew…          ← the drawing
pos=2  0b1c1cb1  The Marlow Knit in Oat, an undyed flecked lambswool crew…           ← the photo, isPrimary
```

The one she picked came last.

## What should have happened

The main photo leads the product page, which is what the screen that sets it
promises.

## Where it lives

[commerce.ts](../../../../wizeworks/services/api-rest/src/routes/v1/public/commerce.ts),
and the whole defect is two selects in one file that disagree:

```ts
// the LIST/card select — line ~1224
images: {
  where: { variantId: null },
  orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],   // right, and its comment says so
  take: 1,
}

// the product DETAIL select — line ~1362
images: {
  orderBy: { position: 'asc' },                            // isPrimary never consulted
}
```

The card got it right and said why: _"Hero thumbnail: explicit primary first,
else first product-level image by position."_ The detail select, forty lines
below, orders by position alone.

## Why it matters

**The action reports success and does nothing visible.** She did the one thing
the screen offers, the screen confirmed it twice — the badge and the reorder —
and the page a shopper actually opens was unchanged. There is nothing on either
screen to tell her which one is lying.

**It only bites where it matters.** A product with one photo cannot show this. It
needs a second photo added later and promoted, which is exactly what happens when
somebody replaces a placeholder or shoots something better. So the defect waits
for the moment the feature is being used for its real purpose.

**`is_primary` and `position` are two orderings and only one of them moved.**
"Make it the main photo" sets the flag; nothing renumbers positions. That is a
reasonable design — the flag is the answer — but only if every reader consults
it.

## The fix

The detail select now orders the way the card select does, and says why:

```ts
orderBy: [{ isPrimary: 'desc' as const }, { position: 'asc' as const }],
```

## Confirmed by

The API, before and after, on the same product: `pos=2` (the photo) moved from
last to first. Then her live page, which now serves
`0b1c1cb1-08ad-4595-b257-c34e926a0f09` with the alt text she wrote for it.

`api-rest`: **431 tests across 76 files**, all passing.

## What this was found doing, which is finished too

RULE #8's photograph bar, on the three products that were drawings — Marlow Knit,
Linen Shirtdress, The Ash Overshirt. Each now carries **one real photograph**,
uploaded through the Photos tab as Devi, described in her own voice:

| Product           | Now shows                                                        |
| ----------------- | ---------------------------------------------------------------- |
| Marlow Knit       | an oatmeal flecked wool sweater held up against a pale wall      |
| Linen Shirtdress  | the chalk shirtdress, buttoned through, belt tied, against ivy   |
| The Ash Overshirt | the bone corduroy overshirt, collar and patch pockets, worn open |

The eight drawings were taken off through the pane's own **Take it off** control.
Her shop is seven real photographs.

**Correction, 2026-08-29.** This paragraph also claimed "no image under 60 KB
remains attached to any product on the tenant". The claim is TRUE and the check
behind it was blind: it filtered `byte_size BETWEEN 1 AND 60000`, and her
remaining four product photos record **`byte_size = 0`** — they are blueprint
assets whose `key` holds an absolute `images.unsplash.com` URL, hot-linked rather
than stored, so zero is the correct weight and every one of them slipped past the
filter. Re-checked by opening them: the belt, the tee and the trouser are all real
photographs. Recorded because a range filter that silently excludes the sentinel
is exactly the shape [[feedback_structural_checks_go_blind]] is about.

**The removal dialog earned its keep.** A stale click after the gallery reordered
targeted the photo I had just promoted, and the dialog said so by name — _"Take
ash-overshirt-bone.jpg off The Ash Overshirt? This is the main photo, so lists,
cards and search results will fall back to the next one. The file itself stays in
your media library and can be added again."_ Named the file, named the
consequence, said what survives. It is the reason the wrong thing was not
deleted.

## Rating effect

Against `Sell › a product › Media`, and the site's product page. The pane is
good; it was telling the truth about itself and the site was not listening.
