# 125 — The truck finder was empty on every shop, and picking a year hid every part

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 9 (a stranger looking for a 6.7L Cummins injector for a 2019 RAM 2500)
**Surface:** site › Shop, categories, collections and search (the filter column); `/v1/public/commerce/fitment/domains/:id/nodes`, `/v1/public/commerce/products`, the product search index; and, found on the way, `/v1/webhooks/providers/:slug/:installationId` and `/v1/dashboard/home`
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Gillett has 5 makes, 18 models and 51 engines, and 126 parts fitted to them (act 3). On the shop page:

1. **"Fits your vehicle" showed only a Year box.** The list of makes came back empty. The route read `commerce_fitment_nodes` with the bare database client; that table forces row-level security, and with no business set it matches nothing and answers 200 with `[]`. Every shop's truck finder has been empty.
2. **It was the last filter**, 2,315 pixels down, below every brand, type, tag and option.
3. **Each pick needed "Apply"**, which sat at the foot of that long column. Nothing changed on screen until it was pressed.
4. **A pick left the Shop page.** The listing always submitted to `/products`, so a shopper on Doty's own Shop page (his heading and intro) landed on a different page called "All products".
5. **Picking any year hid every part.** Gillett's parts are fitted by engine with no years. The product list required a year window on the rule, and the search index had no years for them, so "2019" meant "nothing fits your truck". Two other parts of the code (collection rules and the fitment service) already read "no years" as "every year".

Reading on for the same mistake (a bare read on a protected table, which returns nothing without an error) found two more:

6. **Every provider webhook was dropped.** `commerce_provider_installations` forces row-level security with no exception, so the webhook route never found the installation, logged a warning and answered 200. Every Shippo tracking update, for every business, went nowhere. Measured as the API's database role: the table looked empty while one Shippo install existed.
7. **`/v1/dashboard/home` counted 0 pages, 0 customers and 0 upcoming bookings for everyone.** Nothing in the consoles calls it any more (the old dashboard is gone), but it still answered wrong numbers.

The other bare reads it turned up are fine: `users`, `members`, `properties`, `api_keys` and two member tables have a read policy for "no business set". Measured, not assumed. A note in `verified-email-guard.ts` said the opposite and is corrected.

## What should have happened

A shopper picks make, model, engine and year, at the top of the filters, and sees what fits. A part listed for the 6.7L Cummins with no years fits every 6.7L Cummins.

## Why it matters

"Does it fit my truck?" is the first question at a diesel parts counter. A finder that offers only a year, then answers "nothing fits", sends the customer to the next shop. The webhook half means tracking updates on shipped orders never arrived for anyone.

## The fix

- `api-rest/src/routes/v1/public/commerce.ts`: the nodes read runs under `withTenant`. The product list treats a rule with no year window as every year.
- `wizeworks/packages/search`: `EVERY_FITMENT_YEAR` (0), like the existing "every site" marker. The year filter matches `[0, year]`.
- `wizeworks/packages/commerce/src/search-projection.ts`: `fitmentRangeValues` adds that marker for a rule with no years or a window open at both ends.
- Site (`facet-panel.tsx`, `products/browse-facets.tsx`, `search-facets.tsx`): "Fits your vehicle" is the first filter. New `submit-on-pick.tsx`: a pick in it submits at once and clears the tiers below. Apply still works without JavaScript. `products/product-listing.tsx` takes the page's own address from the host (`ctx.basePath`), so the Shop page's filters stay on `/shop`; `/products` keeps its own.
- Migration `20270530000030_a_provider_webhook_finds_its_install`: `find_provider_installation_tenant(uuid)` and an owner read policy, the dispatch-scan pattern. The webhook route names the business that way, then reads the installation under it.
- `api-rest/src/routes/v1/dashboard.ts`: counts under `withTenant`.
- Gillett re-indexed locally (`ops:reindex-search -- --apply --tenant=…`). **Every other business needs the re-index after release** for the year marker to reach the index.

Tests, each proved red:

- `api-rest/src/no-bare-reads-on-business-tables.test.ts`: reads every source file and fails on `prisma.<model>.` for a model with `tenantId`, except plain reads on the six tables with a "no business set" policy and the `domains` table (no RLS by design). It found 10 before the fixes, 4 of them real.
- `test/integration/fitment-nodes-public.test.ts` (database): makes, then models. The bare read reddens it with `[]`.
- `test/integration/fitment-year-public.test.ts` (database): year 2019 keeps the no-years part and the 2019–2021 part, not the 2007–2018 one. Without the "no window" branch the no-years part drops.
- `test/integration/provider-webhook-finds-install.test.ts` (database): a Shippo event is recorded against its installation. The bare read reddens it.
- `site/components/products/listing-stays-on-its-page.test.ts`: the listing takes the page's address. Dropping the host's `basePath` reddens it.
- `commerce/src/fitment-range-values.test.ts` (5) and `search/src/every-fitment-year.test.ts` (1): removing the marker reddens 3 of 5 and 1 of 1.

## Confirmed by

On screen, 2026-10-06, as a signed-out shopper on Gillett's shop: "Fits your vehicle" sits first with Make and Year. RAM narrowed 653 parts to 94 and showed Model on its own; 2500 showed Engine (6.7L Cummins, 5.9L 12-valve, 5.9L 24-valve); 6.7L Cummins gave 47, among them the Bosch Reman CR Injector, Cummins 6.7L (0986435519). Year 2019 submitted on its own. After the re-index, RAM 2500, 6.7L Cummins, 2019 shows 47 parts on screen. Picking RAM on `/shop` now stays on `/shop`.

Not this issue: many listed parts name their years in the title ("07-12 Dodge/Ram 6.7L") but carry no year range, so they show for 2019 too. That is Gillett's data (act 3 left the years to place).

## Rating effect

—
