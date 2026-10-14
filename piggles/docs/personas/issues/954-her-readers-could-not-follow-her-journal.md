# 954 — Her readers could not follow her journal

**Status:** fixed (act 7)
**Severity:** major
**Found by:** P09 · The Marrow Review · act 7, as a reader wanting new pieces in a feed app
**Surface:** every site (`/feed.xml`, each page's head), the public feed API (`/v1/rss.xml`)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · act 7, `/feed.xml` listing her five pieces
**Blocked on:** —

## What happened

`/feed`, `/rss` and `/feed.xml` on her site: all 404. No page named a feed. A feed
existed only on the API, and with no kind named it listed **blog posts**, which she has
none of. It also read the whole account, not the site being read.

## The fix

- `services/api-rest/src/routes/v1/rss.ts`: takes `property`; reads only that site's
  pieces (`publishedOnSite`); with no `type`, every kind the site serves at an address;
  links on that site's own address; titled with the site's name; 404 when the site
  switched its writing off.
- `apps/site/app/feed.xml/route.ts` (new): the feed at the site's own address, 404 on a
  dark site or one with writing off, 503 (not an empty feed) when the API is down.
- `apps/site/app/layout.tsx`: every page's head names the feed
  (`<link rel="alternate" type="application/rss+xml">`), so a feed app finds it from the
  site's address.

## Proof

- `rss-links.test.ts`, 4 (3 new). The old route fails all 4.
- `/feed.xml` on her site: "The Marrow Review", her five pieces newest first with their
  standfirsts, each linked on her address. Her home page's head names it. The scheduled
  piece is not in it.
