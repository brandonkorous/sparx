# 070 — Setting what his parts fit: the search, the list and "Remove" each got in the way

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 3 (putting each part on the engines it fits, with the new bulk tools from [065])
**Surface:** workbench › Products list, bulk "What they fit" (both consoles); commerce product search
**Filed:** 2026-10-02
**Fixed:** 2026-10-02
**Confirmed by:** On screen, 2026-10-02, as Doty: "L5P" listed 13 parts (it had listed all 653 before the second fix below); 13 chosen, "Add what 13 products fit" with the L5P on the Silverado and Sierra 2500HD and 3500HD, "13 products now fit 4 entries". The list then showed full names, so "Banks Boost Tube Upgrade Kit for 12-16 … LML (25993)" was visibly not an L5P part; "Remove what 1 product fits", "Choose everything in Vehicle", "1 product no longer fits anything in Vehicle". Database: 12 products, 48 rules; 25993 has none. "25993" (a part number) and "boost tube" both find their parts.
**Blocked on:** —

## What happened

1. **Search looked at the title only, as one phrase.** "L5P" could never find a part set to fit the L5P unless "L5P" was in its name; "6.7L Cummins" missed every title written "Cummins 6.7L"; a part number found nothing.
2. **My first fix for (1) made every search on his site return all 653 products.** The search and the site filter were both written as `AND`, and the site's replaced the search's. The test passed because it never set a site.
3. **Names were cut at 16rem.** Doty's names put the years and the engine last ("Banks Boost Tube Upgrade Kit for 12-…"), so an LML part and an L5P part looked the same. I put the L5P on the LML part. (It matched "L5P" because its web address, copied from his old store, says "l5p".)
4. **"Remove what they fit" removed nothing when you chose a make or the whole list.** The dialog offers "Choose everything in Vehicle". It removed only a rule set at exactly that level, so a part set to fit four engines kept all four, and the toast said "none of them were set to fit everything in Vehicle".

## Fix

- `commerce/src/services/product-selection.ts`: `searchWhere` matches each word anywhere on the product: title, web address, brand, kind, any version's code, any entry it fits. It is joined to the site filter rather than spread beside it. Tests: no fitment clause reddens 1; matching the whole phrase reddens 1; spreading the site filter again reddens 1.
- `commerce/src/services/fitment-bulk.ts`: removing an entry removes it and everything under it (by the entry's stored path); choosing the whole list removes every rule in that list. Rules in other lists stay. Tests: exact-entry removal reddens 1; the old whole-list rule reddens 1.
- Both consoles:
  - The product name takes the free width and wraps to two lines; the date no longer breaks.
  - The search box says "Name, code or brand…".
  - The remove dialog says that taking off an entry takes off everything under it.
  - The toast says "no longer fits anything in Vehicle" / "none of them fit anything in Vehicle". Old wording reddens 2.
- Commerce 256 tests pass; typecheck clean (commerce, sparx workbench).

## Decided: a changed web address is not redirected

When Doty fixes a product's web address (the LML part whose old address says "l5p"), the old address stops working, and the product screen warns him before he saves. Brandon decided on 2026-10-02 to keep the warning only. An automatic redirect would let one business hold on to every address it ever used, and those addresses could then not be used by anyone else. Nothing to build.
