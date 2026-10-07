# 126 — No product page said what the part fits

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 9 (a stranger reading the Bosch Reman CR Injector, Cummins 6.7L page)
**Surface:** site › every product page; workbench › Editor › Insert ("What it fits"); the default "Each product" template
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Gillett's parts carry 443 fit rules (act 3). A product page showed none of them: only the description the part came with from Shopify, where this injector's text says "2007-2010 Dodge Ram 3500 Cab & Chassis". The fit table was built long ago and lived in the previous generation of product pages. When product pages became builder templates, nothing could place it, and nothing said it was gone. The same happened to the "save for later" heart (issue 642).

## What should have happened

A product with fit rules lists them on its page: make, model, engine, and years where set.

## Why it matters

"Will it fit my truck?" is the question a parts buyer asks before anything else. Without the list they call the counter, or buy the wrong part and send it back.

## The fix

- `wizeworks/packages/silica-catalog/src/host-nodes.ts`: a new block, `commerce.product-fitment`, labeled "What it fits" in the builder's Insert list (Your shop). Unpinned, like reviews and questions; heading editable.
- `silica-catalog/src/commerce.ts`: the default product page places it under the buy box, so new shops get it. It draws nothing for a product with no fit rules.
- `wizeworks/apps/site/components/products/product-fitment-core.tsx` + `silica-host-cores.tsx`: the site draws it with the existing fit table.

A shop with its own saved product page (Gillett has one) adds it in the Editor; the default does not overwrite a saved page.

Tests, each proved red:

- `silica-catalog/src/product-page-shows-fit.test.ts`: the default product page places it, unpinned; the Insert list names it "What it fits". Removing it from the default reddens 1 of 2.
- `site/components/every-host-core-renders.test.ts`: every block the builder offers has a case in the site's renderer (a block without one draws nothing, silently). Removing the new case reddens it.
- `silica-catalog/src/site-chrome.test.ts`: the unpinned list now includes it, with the reason.

## Confirmed by

On screen, 2026-10-06, as Doty in the Editor: "Each product", Insert, "fits" found "What it fits"; with the buy-box section selected it went in after "Shipping & delivery / Returns & refunds" and before "You might also like"; Publish said "Your site is published". As a shopper, the Bosch Reman CR Injector page shows "What it fits" with Make / Model / Engine: RAM 2500 6.7L Cummins, RAM 3500 6.7L Cummins.

Seen on the way, not this issue:

- That injector's own description says it fits 2007-2010 cab-and-chassis trucks (3500 to 5500). Its fit rules say RAM 2500 and 3500, any year. Gillett's data; act 3 left the years and models to place.
- The Editor has no way to move a block except dragging. The browser tool's drags are too quick for it, so placement here went through "select the section, then insert". A person with a mouse can drag. A keyboard user cannot reorder at all: noted for the builder (silicaui).

## Rating effect

—
