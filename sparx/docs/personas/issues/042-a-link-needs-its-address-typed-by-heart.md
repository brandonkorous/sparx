# 042 — Changing a link means typing its address by heart

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** workbench › Editor › any link › Settings › LINK › "URL"
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** sparx as Doty, 2026-10-17, read from the page (silicaui 0.60.2 installed)
**Blocked on:** — (the silicaui release it waited on shipped; 0.60.2 is installed)

## What happened

Doty pointed his product page's "Returns & refunds" link at his Refund Policy. The
link's settings show a text box labeled "URL" holding `/returns-policy`. There is
no list of his pages and no suggestions while typing. He had to know
`/refund-policy`, which is shown on Legal pages, two screens away. "URL" is also a
word he does not use. It happened again on his homepage: pointing "Contact us" at
his Contact page meant typing `/contact`.

## What should have happened

Pick a page: a list of his own pages (and policy pages, products, collections) by
name, and still free typing for an outside address.

## Where it lives

- silicaui 0.57.0 (published) already suggests the site's own BUILDER pages in that
  box (a `<datalist>`). sparx is pinned to 0.56.0, so it never got even that.
- Builder pages are not everything a link can reach: policy pages are CMS pages,
  and products, collections, categories, blog posts and booking pages are the
  site's own routes. None of those would ever have been offered.

## The fix

- **silicaui** (`packages/silicaui-builder`, source only, not released):
  - new `BuilderHost.linkTargets()` (+ exported `LinkTarget`): places a link can go
    that are not builder pages, offered by name after the site's own pages, an
    address offered twice listed once;
  - read on every render, not memoized on the host, so a list that arrives late
    still shows;
  - the box is labeled **"Links to"**, not "URL".
- **api-rest**: `GET /v1/builder/site/link-choices` (`lib/link-choices.ts`): CMS
  pages (policy pages included) and blog posts by title, the shop's routes, every
  collection, category and product, the booking page and each service, by name,
  each roster only when its module is on. The same rosters as the pre-publish
  check, so a picked link is one the check calls working. Test
  `lib/link-choices.test.ts` 3/3; red with the leading `/` removed.
- **workbench**: `useLinkChoices()` (`surfaces/builder/studio/data.ts`) feeds
  `linkTargets` through `buildStudioHost` (`host.ts`). The option is spread, so it
  compiles and runs on 0.56 and is used from 0.58.

Checks: silicaui-builder tsc 0; api-rest tsc 0; workbench tsc 0.

## Confirmed by

sparx as Doty, 2026-10-17, silicaui 0.60.2 installed. Editor › Home › the "Contact us" link › Settings › LINK › "Links to" (`/contact`): the box is wired to a suggestion list of 700 places, starting "/ Home", "/shop Shop", "/contact Contact", then his policy pages ("/refund-policy Refund Policy", "/shipping-policy Shipping Policy", "/terms-of-service Terms of Service"), his posts, collections and categories. Read from the page: the browser's own drop-down list does not show in a screenshot, so it was not seen open.

## Rating effect

Editor: Ease deduction stays until the box is seen offering his pages.
