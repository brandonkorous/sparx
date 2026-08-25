# 195 — The cross-sell was bigger than the thing it was selling

**Status:** fixed and confirmed
**Severity:** design
**Found by:** Brandon, on Juniper Row's product page · 2026-08-24
**Surface:** every tenant website — the Featured strip, and 66 blueprints
**Filed:** 2026-08-24
**Fixed:** 2026-08-24
**Confirmed by:** Juniper Row · 2026-08-24
**Blocked on:** —

## What happened

Brandon, looking at the Ash Overshirt's page:

> on the product page, you can't have a featured product that is more the focus
> point than the actual product. the featured product list, should be multiple
> products (even if you only have one, which we should handle like centering or
> something).

He is right, and it is the half of [187] that was closed as blocked. Under a
product page's buy box, the "Featured" strip rendered ONE card at the full width
of the page — larger than the photograph of the garment the page exists to sell.

## Why it matters

A cross-sell that outweighs the product inverts the page. A shopper's eye lands
on the thing the shop is not trying to sell them, and the rail stops being a rail
— one item at a time is a slideshow, and a slideshow of two products is a worse
way to compare two products than putting them side by side.

## Where it lives

[commerce.ts](../../../../wizeworks/packages/silica-catalog/src/commerce.ts) —
`featuredCarousel()` was built on silica's **`carousel`** behavior, which shows
exactly one slide per view. Beside it sat `basis-full @2xl:basis-1/3
@4xl:basis-1/4`, a ladder meaning "one card on a phone, four on a desktop", which
never applied at any width: measured live at a 2543px container, strip 1152px and
slide 1152px.

**[187] concluded that multi-per-view needed a silicaui change. That was wrong,
and it is the interesting part of this issue.** silicaui already ships the right
behavior, and its own description is this exact job:

> `scroll-strip` — a real `overflow-x: auto` track whose prev/next controls
> appear only once the content stops fitting, then disable at each end. Not
> `carousel`, which translates a track of full-width slides one at a time — here
> **every item is meant to be visible at once**.

The mistake was reaching for the component named like the thing (a carousel of
products) instead of the one described like the job. It cost an issue closed as
blocked on a decision that was never needed.

## The fix

**The strip is a `scroll-strip`.** Everything that was going to be asked for
comes with it, from the component rather than from the call site: controls that
appear only when the cards overflow and disable at each end, hidden scrollbar
chrome because the buttons replace it, and static markup that ships them already
`hidden` so a no-JS render degrades to a plain scroller instead of two dead
buttons.

The cards are `w-64 shrink-0` — four across a capped page, one plus the sliver of
the next on a phone, which is the affordance that says there is more.

**Centering one product, without stranding twelve.** The row is `flex w-max
gap-6 mx-auto`. `justify-center` on a scroll container puts the leading card
behind an edge nobody can scroll back to; auto margins only distribute POSITIVE
free space, so they centre a shop with one featured product and resolve to zero
for a shop with twelve.

The controls also lost `btn-neutral btn-outline` on the way through — a grey
nobody approved (root RULE #4), on a control that carries no meaning for a color
to hold.

## The 66 blueprints, which is the other half of what he asked for

> and this again should be applied to the templates/blueprints

A blueprint's `site.json` is a STAMPED tree: the factory ran once and the result
was frozen, so fixing `commerce.ts` reaches the next tenant and no existing
bundle. **66 of them carried the broken strip**, ladder and all.

The repair is written ONCE, as a rule in
[upgrade-page.ts](../../../../wizeworks/packages/silica-catalog/src/upgrade-page.ts) —
the same upgrade-on-read that heals a live tenant's stored draft at studio load,
and it clears that file's own three-part bar: broken on published sites, stamped
by the platform, known replacement.

[codemod-featured-strip.mjs](../../../../scripts/codemod-featured-strip.mjs) then
runs that exact function over the bundles. It does not reimplement the transform;
a second copy is a second thing to keep correct. It bumps each changed bundle's
patch version, because a content change with no bump is a change no installed
tenant is ever offered (`check-blueprint-versions.mjs` enforces it, and passes).

The rule is careful about what it touches: it recognises the strip by the
`carousel-item` PRODUCT CARD, not by the behavior alone. A hero carousel an
author built by hand is theirs, one slide at a time is what it is for, and a test
pins that it is left completely alone.

## Confirmed on screen

**The Ash Overshirt's page** — "Featured" now carries one Marlow Knit card at
normal card size, centred, with the controls correctly absent because nothing
overflows. It no longer outweighs the product above it.

**The catalog** — 1173 tests pass, including seven new ones covering the
behavior swap, the side-by-side widths, the centering, the control class, and the
author's-carousel exemption.

**The bundles** — 66 healed, 132 files, every version bumped, the version guard
green.

## Rating effect

None recorded — the tenant's own website has no row in [rating.md](../rating.md).
