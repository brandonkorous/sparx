# 069 — The till and every item picker could not find anything past the 500th item

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 4 (pointing a stock row at an existing item)
**Surface:** workbench › counter sale (till), repeat orders, and every item picker (bundles, price lists, pricing tiers, returns, stock import, pre-orders); both consoles
**Filed:** 2026-10-02
**Fixed:** 2026-10-02
**Confirmed by:** On screen in the sparx console, 2026-10-02 (builder agent, as Doty): the first 500-item window ends at "Holset 3539370H New HX35W Turbo…"; "Stanadyne Diesel Fuel Additive (38565)", past it, is found in the till, in the repeat-order picker ("38565 stanadyne", words in either order) and in the bundle picker, each by `GET /v1/commerce/variants?q=…&take=40`. The stock import's "It is one I have" found the Bosch Fuel Rail the same way.
**Blocked on:** —

## What happened

Every picker loaded the first 500 items, A to Z, and searched only those in the browser. Gillett has 693, so a part late in the alphabet could not be sold at the counter, added to a bundle, priced on a price list, or matched in a stock import. Nothing said so: the search just answered "no match". The code's own comment said a bigger catalog "is the signal to give that endpoint a real `q`".

When a search failed, each picker said "Try again in a moment". Trying again did nothing: the failed search kept its error until the words changed, and in the till and repeat orders the error replaced the search box, so there was nothing to try again with.

## Fix

- API `GET /v1/commerce/variants` takes `q` (and `product_id`): every word must match the product name, the code, the version's name or an option value. Site scope and the archived filter are kept (`api-rest/src/lib/variant-search.ts`).
- Both consoles: `useVariantSearch` asks the server for anything typed (debounced), keeps the previous answer on screen while the next loads, and never says "no match" while an answer is on its way. The till, the repeat-order picker and `VariantPicker` use it; `VariantPicker` fetches its preferred product directly.
- The failed-search message has a "Try again" button that asks again (an `AlertActions` slot in the till and repeat orders).
- Tests: api-rest variant-search 10, consoles variant-search and sale-sellable-search 27 each. Red proofs: option values out reddens 4; site scope dropped reddens 1; archived filter dropped reddens 1; browser-side option values out reddens 4; preferred product out reddens 2; till keywords out reddens 1.

## Not checked yet

"Try again" on screen: it needs a search to fail. To check the next time the API restarts.
