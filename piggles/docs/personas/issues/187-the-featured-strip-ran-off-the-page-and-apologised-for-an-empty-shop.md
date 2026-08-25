# 187 — The featured strip ran off the page and apologised for an empty shop

**Status:** fixed and confirmed
**Severity:** design
**Found by:** Brandon, on Juniper Row's product page · 2026-08-24
**Surface:** every tenant website — the products block, on every page that carries one
**Filed:** 2026-08-24
**Fixed:** 2026-08-24
**Confirmed by:** Juniper Row · 2026-08-24
**Blocked on:** — (was: a silicaui change. It was not one; see below)

## What happened

Four things on one strip, on the Marlow Knit page:

1. **The section ran edge to edge** while every other section on the page was
   capped. "Featured" started at the window edge; the buy box above it started
   450px in.
2. **It said "Nothing in the shop just yet. Check back soon."** — on the page of
   a product that is in the shop, on sale, buyable, with the Add to cart button
   six inches above the sentence.
3. **It scrolled with a raw scrollbar** instead of the Previous/Next buttons.
4. And underneath all of it, **the strip only ever showed one card**, whatever
   the width.

## Why it matters

The empty sentence is the worst of them, because it is false and a customer
reads it. A one-product shop tells every visitor it has nothing, on the page of
the thing it sells.

The rest is the difference between a site that looks made and a site that looks
generated. A single full-bleed section on a page of capped ones does not read as
"wide", it reads as broken.

## Where it lives

[commerce.ts](../../../../wizeworks/packages/silica-catalog/src/commerce.ts) —
`productsBlock`, the one block every product listing on every tenant site is a
preset of.

**The width.** The block had no inner container at all. The footer, the shop
header and the nav all use `mx-auto w-full max-w-6xl`; this had nothing.

**The empty sentence.** `repeatOrEmpty` always writes one, and the block used it
for every layout. On a product page the rail is a CROSS-SELL, so the storefront
excludes the product being looked at — a one-product shop resolves 1 − 1 = 0 and
gets the apology. The behavior is right; the sentence under it is not.

**The scrollbar.** `featuredCarousel()` — the same block with real controls and
silica's `carousel` classes — was already built, tested, and offered in the Add
palette. Nothing called it. The starter's home page and the default product page
both dropped `featuredProducts()`, the bare `overflow-x-auto` rail. The better
thing existed and was unreferenced, which is the third time that shape has turned
up this week ([183], [184]).

**The one card.** The slide carried `basis-full @2xl:basis-1/3 @4xl:basis-1/4`,
meaning one card on a phone and four on a desktop, with a paragraph of comment
explaining the container-query reasoning. **None of it had ever applied.**

## The fix

- **Content width.** One `CONTENT_WIDTH` constant (`mx-auto w-full max-w-6xl`),
  used by every layout, so it cannot drift from the chrome again.
- **A curation says nothing when it has nothing to say.** The heading leaves with
  its products — it is the heading that turns an empty strip into a visible hole.
  The whole-catalog **grid** keeps its sentence: a shopper who navigated to the
  shop asked the question and is owed the answer. A rail is a garnish nobody
  asked for.
- **The carousel is the default now**, in the starter's home page and in the
  code-authored product page. The rail preset stays, because choosing one in the
  editor is legitimate; nothing ships it.
- **The controls are colorless.** They were `btn-neutral btn-outline` — a grey
  nobody approved (root RULE #4) on a control that carries no meaning for a color
  to hold. A bare `.btn` resolves its ink from `base-content` and is right in both
  themes without naming one.

### One approach was wrong and the tests caught it

The first version hung `visible` on the whole `<section>`. That looks correct and
is not: `visible` reads `resolveBinding` while a repeat reads `resolveCollection`
(see `conditional.ts`), and on an unanswerable ref the engine keeps the node **as
authored** and stops — so the repeat beneath it never resolved and the strip
rendered its placeholder card, "Product name · $0.00", on a live site.
`record-templates-render` failed on it. The heading is now a **sibling** of the
repeat, the same shape the empty sentence has always used, one polarity apart.

The package's own test host was also lying: it implemented `resolveBinding` for
scoped items only, while the real resolver answers root paths too. Fixed rather
than worked around, because a double that under-reports a host capability turns
into a fix that only works where it was tested.

## The part this closed as blocked, and was wrong about

**"A carousel can only show one slide at a time"** was true, and the conclusion
drawn from it was not. Measured on the live storefront at a 2543px container:
strip 1152px, slide 1152px. Deleting every `basis-*` changed nothing; adding a
bare `basis-1/4` changed nothing; removing `carousel-item` changed nothing. All
of that is correct — silicaui sizes a carousel's children itself.

What followed it was wrong:

> Multi-per-view is a **silicaui** change (a per-view modifier, or a
> `--carousel-per-view` variable), and silicaui ships from npm and is not
> editable in this repo, so it is Brandon's call.

It needed no silicaui change and no decision. silicaui ships a SECOND behavior,
`scroll-strip`, whose own description is this exact job — "not `carousel`, which
translates a track of full-width slides one at a time; here every item is meant
to be visible at once" — along with the controls, the hidden scrollbar and the
no-JS degradation that were about to be asked for.

The mistake was reaching for the component named like the thing rather than the
one described like the job, and then writing the dead end up as a platform
limitation. A blocked issue is a claim about the world, and this one was not
checked before it was made.

Fixed, with the 66 stamped blueprints migrated with it, in
[195](195-the-cross-sell-was-bigger-than-the-thing-it-was-selling.md).

## Confirmed on screen

**Marlow Knit's page** — the "Featured / Nothing in the shop just yet" hole is
gone entirely; the page ends at the buy box.

**Home** — "Featured" with real Previous and Next controls, no scrollbar, capped
to the same width as the "Shop our products" grid above it and aligned with it.
Controls render as colorless circles.

1158 catalog tests pass, including seven new ones covering the empty curation,
the content width, the colorless controls, and the absent ladder.

## Rating effect

None recorded — the tenant's own website has no row in [rating.md](../rating.md).

[183]: 183-the-customer-picker-only-knows-the-first-hundred.md
[184]: 184-the-page-that-sells-the-knit-never-said-it-has-to-be-made.md
