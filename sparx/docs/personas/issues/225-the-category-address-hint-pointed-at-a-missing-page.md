# 225 — The category's address hint pointed at a page that does not exist

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · standing checks (wrong moves: delete "Injectors")
**Surface:** workbench › Selling › a category, a collection, a product (the web address hint); same in Piggles
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P01 on screen, 2026-10-11 (sparx)
**Blocked on:** —

## What happened

On the Injectors category, under "Web address", Doty read: "The end of this category's
page address: yoursite.com/c/injectors."

Two things are wrong with it:

- Gillett's site has no `/c/` pages. `/c/injectors` answers 404; the category is at
  `/category/injectors`.
- "yoursite.com" is not his address. His site is gillettdiesel.sparx.zone, and the
  product's own search preview on the next panel already says so.

The collection and product hints say "yoursite.com/collections/…" and
"yoursite.com/products/…": right paths, made-up address. Piggles' three say
"yoursite.com" too.

## What should have happened

The hint gives the real address a shopper would type: his site's address, then the path
the site really serves.

## How to reproduce

1. As Doty, open Selling › Categories › Injectors.
2. Read the line under "Web address". Copy "/c/injectors" onto his site: 404. Every time.

## Why it matters

He shares a category link by copying what the screen tells him, and the customer lands
on "page not found". It says something false about where his own pages are.

## Where it lives

- `sparx/apps/workbench/surfaces/commerce/category-detail.tsx`: "yoursite.com/c/" typed
  into the hint.
- `collection-detail.tsx`, `product-detail.tsx` (and Piggles' `category-detail-basics.tsx`,
  `collection-detail-basics.tsx`, `product-add-fields.tsx`): "yoursite.com" typed in.
- The site's paths are written once, in `wizeworks/packages/silica-catalog/src/record-templates.ts`
  (`RECORD_ADDRESSES`: `/products/`, `/collections/`, `/category/`). The hints did not
  read it.
- The site's address is worked out twice already, the same way, in `product-detail.tsx`
  and `product-seo.tsx` (canonical address of the site being worked in, else its first).

## The fix

Both consoles:

- `surfaces/commerce/page-address.ts` (new): `pageAddress(host, record, handle)` takes
  the path from `recordAddressFor` (silica-catalog's `RECORD_ADDRESSES`, the table the
  site's pages are built from). With no address known it prints the path alone, never
  a made-up one.
- `surfaces/domains/site-host.ts` (new): `siteHostOf` and `useSiteHost`, the site's main
  address else its first live one. The two copies of that rule (the product's "See it
  on your site" link, its search preview) now call it.
- The hints on a category, a collection and a new product print
  `pageAddress(host, …)`. Sparx: `category-detail.tsx`, `collection-detail.tsx`,
  `product-detail.tsx`, `product-seo.tsx`. Piggles: `category-detail-basics.tsx`,
  `collection-detail-basics.tsx`, `product-add-fields.tsx`, `product-detail-actions.tsx`.
- Left as it was: Piggles' `product-seo.tsx` (409 lines, over Piggles' size rule for a
  touched file) keeps its own copy of the address rule and its "yoursite.com" stand-in
  while the domains load. Sparx's search preview keeps that stand-in too: it draws a
  search result, which needs some address.

Tests, red first: `page-address.test.ts` in each console (8; the three screens red
before). It also checks the site has a page folder at each path
(`wizeworks/apps/site/app/<path>/[handle]/page.tsx`), so the table and the site cannot
part. Commerce and domains tests: sparx 473, Piggles 513 pass. Lint clean.

## Confirmed by

P01 on screen, 2026-10-11, as Doty: Selling › Categories › Injectors reads "The end of
this category's page address: gillettdiesel.sparx.zone/category/injectors. Changing it
breaks any link already shared to this page." `/category/injectors` answers 200 on his
site; `/c/injectors`, the old hint, 404. Not checked: Piggles on screen.

## Rating effect

—
