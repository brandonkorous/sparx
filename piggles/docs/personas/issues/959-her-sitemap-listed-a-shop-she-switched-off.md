# 959 — Her sitemap listed a shop she switched off

**Status:** fixed (act 8)
**Severity:** major
**Found by:** P09 · The Marrow Review · act 8
**Surface:** every site: `/sitemap.xml`
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · act 8, her sitemap
**Blocked on:** —

## What happened

Her piece was in her sitemap, with every other piece. So were `/shop`, `/products`,
`/collections`, `/category`, `/book`, `/collections/featured` and
`/collections/bestsellers`. Her site has Selling and Bookings switched off under "What
this site shows". Six of those seven answer 404. `/book` still answers, which issue 944
already records.

A sitemap is the list a business hands search engines of the pages it wants found. Seven
of her 30 were pages that do not exist.

## Why

`api-rest/src/routes/v1/sitemap.ts` asked the site's switches only for the starter pages
it fills in. A page the blueprint had published (Shop, Products, Collections, Category,
Book) was listed whatever the switches said, and so were product collections.

## The fix

- `lib/sitemap-urls.ts`: `modulesOff` reads the site's switches plus the modules the
  account lacks. `pageShownOnSite` asks the same two questions the site's own gate asks:
  does a switched-off module own the address, and does the page carry a switched-off
  module's live block (her "Shop" page is a product grid with a heading).
- `routes/v1/sitemap.ts`: every list asks. Published pages, products, collections and
  categories leave out what the site does not show. A site with Content off lists no
  pieces and no author pages, and keeps its own pages (policies, About).

## Proof

- `sitemap-urls.test.ts`, 4 new (12 in all): a switch on the site and a missing module
  both count as off; `/products`, `/book` and `/collections` are left out; a "Shop" page
  is left out by its product grid; her own pages stay, and a selling site keeps its shop.
  With the check removed, 2 redden.
- Her sitemap: 23 addresses, every one 200. Juniper Row's still lists `/shop`,
  `/products`, `/collections`, `/category`, `/book` and `/blog`.
