# 065 — 653 products, and fitment and categories could only be set one product at a time

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 3 ("searching L5P finds the parts that fit it")
**Surface:** workbench › Products (bulk actions); Fitment; a product's Fitment
**Filed:** 2026-10-01
**Fixed:** 2026-10-02
**Confirmed by:** On screen in the sparx console, 2026-10-02, as Doty:

- **What they fit:** "L5P" → 13 chosen → the L5P on Silverado and Sierra 2500HD/3500HD → "13 products now fit 4 entries" (one was an LML part, taken off again, see [070]). "6.7L Cummins" → 47 → RAM 2500/3500 → "47 products now fit 2 entries". "6.7L Powerstroke" → 18 → F-250/350/450 → "18 products now fit 3 entries"; then "6.7L Power Stroke" → 23 → "5 products now fit 3 entries. 18 already fit it."
- **Categories:** for each of his 18 kinds, the kind filter, then "Choose all 126 that match" where the kind ran past a page (Delete hid itself), then "Put in a category", typing a new name, "Make a new category called …": 18 categories, each holding exactly its kind's count (Fuel System 126 … Emissions Equipment 1); 652 of 653 products, the 653rd has no kind.
- **Done-when:** Products search "L5P" 13 (all 12 L5P parts, plus the LML part whose web address from his old store says "l5p"); "6.7L Cummins" 47; "6.7L Powerstroke" 23.
- Piggles: built the same, typecheck and tests clean; not driven on screen.
  **Blocked on:** —

## What happened

Act 3 is done when searching "L5P" finds the parts that fit an L5P Duramax. After
the import, 0 products had any fitment and the only category was the template's
"Goods". Searching "L5P" found 12 products, only because "L5P" is in their titles; a
part titled "2017-2019 GM Duramax 6.6L" fits the same engine and was not found.

His fitment exists: his old store put 604 of 653 products in vehicle collections, and
313 products carry a fitment line in their own words ("2020–2023 GMC Sierra 2500/3500
HD (6.6L L5P Duramax)"). His 18 product types (Fuel System 126, Turbochargers 101, …)
arrived only as a text field.

What he could do about it in sparx:

- **The Products list's bulk bar** offers Delete and Retire, nothing else. No "put in
  a category", no "set what it fits".
- **Fitment** can be set on one product at a time. For 600 products that is not a
  task anybody finishes.
- `fitmentService.bulkAssign` exists, documented as "used by catalog importers (AAIA,
  supplier feed, merchant CSV)". Nothing calls it: no importer reads fitment, and no
  screen offers it. It also REPLACES a product's fitment, which is the wrong shape for
  "add the L5P to these 34 parts".
- **The ready-made Vehicle list** says "Each of these is a full list you can use
  as-is". It has 4 makes and 21 entries: a Mustang and a Tacoma, no GMC, two of the
  six Duramax engines.

## What should have happened

From the Products list: search or filter, choose every match (not just one page), and
put them in a category or add the engines they fit, in one step.

## Fix

Built by a builder agent, reviewed and driven on screen.

- **Endpoints:** `POST /v1/commerce/categories/:id/add-products` and `/remove-products`, `POST /v1/commerce/fitment/bulk-add` and `/bulk-remove`, all taking `{ selection }`: either `{productIds}` or `{match: {q, status, productType, …}}` (the list's own filter, `productListWhere`, so the count on screen is the count that acts; capped at 2,000 and refused, never truncated, past it). `GET /v1/commerce/products/types`; `bulk-status` also takes a selection.
- **Adding what parts fit never takes anything away** (`fitment-bulk.ts`): a rule already there is skipped; the list, the entry and the year windows make a rule's identity. Removing takes an entry and everything under it (see [070]).
- **Categories:** adding keeps a product's other categories; a product with none gets this one as its main one; removing the main one hands the role to the next.
- **Both consoles:** "Choose all N that match" once a page is ticked; a kind-of-product filter; Category and What they fit menus in the bulk bar; Delete hidden in every-match mode; dialogs whose buttons name the count; toasts that say what moved and what was already there.
- **MCP:** `add_products_to_category`, `remove_products_from_category`, `add_fitment_to_products`, `remove_fitment_from_products`; `bulk_assign_fitment` now says it REPLACES.
- **On the way:** a rule with only a "To" year could not be saved (the range schema refused `null`); the starter Vehicle list no longer calls itself "a full list you can use as-is".
- **Tests:** fitment-bulk 10, category-membership 5, product-selection 9, product-bulk 5, products-bulk-words 13 per console; each rule proved red by breaking it (replace instead of add, duplicate skip removed, years left out of identity, category add not idempotent, other categories removed, deleted products reachable).

## Found while confirming

[067] the add box suggested a Ford under GMC; [068] opening stock; [069] item pickers could not reach past the 500th item; [070] search, cut-off names and "Remove".
