# 052 — "import products" found the dropshipping list, not Move in

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 3
**Surface:** workbench › Search everything
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** On screen, 2026-10-01 (sparx): "move my products from shopify" → Move in, alone; "import products" → Move in first, Supplier products second; "import shopify products" → Move in first. Piggles: not checked.
**Blocked on:** —

## What happened

Doty wanted to bring his 653 Shopify products over. In Search everything:

- "move my products from shopify" found nothing ("Nothing matches that").
- "import products" found one screen: **Supplier products**, the dropshipping
  catalog. That is where a supplier's listings are synced, not where a business
  moves in.
- Only "shopify" alone found **Move in**.

## What should have happened

The owner's own words for moving a business in reach Move in, first.

## Where it lives

- `lib/surfaces/catalog/platform.ts` (both consoles): Move in was tagged with
  single words only. A phrase needs every word to match, and "products",
  "move" and "from" were not among them.
- `components/launcher-match.ts` (both consoles): a row that matched the whole
  typed phrase scored the same as a row that matched its words one at a time, and
  the tie went to whichever was registered first.

## The fix

- Move in carries the phrases an owner uses: "import products / customers /
  orders", "move my products / customers / orders from another shop", "bring my
  products over".
- A whole-phrase match on a multi-word query now ranks 2 above the same rung
  reached word by word.
- Three cases in `launcher-owner-phrases.test.ts` (both consoles); "import
  products" failed before the ranking change.

Checks: launcher tests 51/51 in both consoles.

## Rating effect

Search everything: Ease deduction until re-proved on screen.
