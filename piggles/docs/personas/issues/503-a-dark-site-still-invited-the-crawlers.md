# 503 — A dark site still invited the crawlers, under the shop's own name

**Status:** fixed and proven
**Severity:** critical
**Found by:** Devi, following the red band at the top of her console
**Surface:** `wizeworks/apps/site` — every page route and all three crawler routes
**Filed:** 2026-09-14

## What she saw

A band across the top of every screen in the console:

> **Your site is offline. It comes back as soon as a payment goes through.**
> [Keep my business running]

That is true. Her trial ended on 6 September, the seven-day grace window ran out
on the 13th, and juniper-row.piggles.site now serves the "site unavailable"
overlay instead of her shop. The console is not lying and the overlay is doing
its job.

What the overlay does not do is tell anybody else.

## What a crawler got

Measured against her live dark site:

```
<title>            Juniper Row, small-batch clothing made in Denver
meta description   Shirts, dresses and knitwear cut and sewn by hand in a Denver
                   studio, six of each size in a run. Free US delivery over $150
                   and thirty days to change your mind.
og:title           Juniper Row, small-batch clothing made in Denver
meta robots        index, follow
robots.txt         User-agent: *  (only the usual /api /cart /checkout exclusions)
                   Sitemap: https://juniper-row.piggles.site/sitemap.xml
                   plus eleven AI crawlers welcomed by name
sitemap.xml        43 <loc> entries
llms.txt           her store identity, description and entry points
```

Forty-three URLs, advertised to every crawler on the internet, every one of them
now serving a blank "back soon" page — under her real title and her real
description, marked **index, follow**.

That is worse than being offline. Being offline is temporary. Being re-indexed is
not: the business pays the bill, the site comes back, and its listings are gone,
because a search engine spent the dark week replacing forty-three real pages with
one empty one. The punishment for a late invoice outlives the invoice.

And the AI crawlers are welcomed **by name** in that robots.txt, which is a
deliberate and good decision when the shop is up. While it is dark it hands an
answer engine a shop to describe and a blank page to describe it from.

## Why

The root layout does guard this. `app/layout.tsx` returns
`title: 'Temporarily unavailable'` and `robots: { index: false, follow: false }`
for a suspended site, with a comment saying exactly why.

**It cannot win.** In Next's App Router a route's metadata overrides its layout's,
and five page routes write `index: true` explicitly:

```
app/page.tsx:71
app/[...slug]/page.tsx:90, :135, :171
app/blog/[slug]/page.tsx:85
```

Every page a crawler would actually want overwrote the guard with the opposite
answer. Three more routes (products, collections, category) and two booking
routes overwrote the title without touching robots, which leaks the shop's name
just as well.

**A base that a page can overwrite is not a guard.** It reads like one, it has a
comment explaining itself like one, and it had been sitting there being wrong for
as long as any page route has existed.

The three crawler routes — `robots.txt`, `sitemap.xml`, `llms.txt` — never had a
guard at all. They resolve the site and answer, and none of them had ever asked
whether the site was serving anything.

## What changed

A single `lib/suspended.ts` holding what a dark site says to a machine, and a
check in every route that resolves a site:

- **`SUSPENDED_METADATA`** returned by all eight page-level `generateMetadata`
  functions before they say anything about the tenant. One of them,
  `book/[serviceId]`, never resolved a site at all and titled itself from the
  tenant's own service name; it does now.
- **`robots.txt`** becomes `User-agent: *` / `Disallow: /`, with no sitemap line.
- **`sitemap.xml`** and **`llms.txt`** return 404. A 404 rather than an empty
  document, because an empty `<urlset>` reads as "this shop has no pages", which
  a search engine may act on, where a missing sitemap reads as "ask again later",
  which is the truth.
- All three cache for five minutes rather than an hour, because suspension lifts
  the moment a payment goes through and a crawler holding a stale "stay out"
  costs the business re-crawling it has already paid for.

## Proven both ways

Dark (Juniper Row, suspended):

```
title              Temporarily unavailable
meta robots        noindex, nofollow
meta description   (none)
og:title           (none)
robots.txt         User-agent: *  Disallow: /
sitemap.xml        404
llms.txt           404
```

Healthy (Ridgeline Outfitters, active) — unchanged:

```
title              Ridgeline Outfitters
meta robots        index, follow
robots.txt         Sitemap: ... present, not disallow-all
sitemap.xml        200, 3 URLs
llms.txt           200
```

## What nearly stopped this being found

`curl -o /dev/null -w "%{http_code}"` against her site returned **200**, and for
several minutes that looked like proof the console was crying wolf. It was not
proof of anything: the overlay IS a 200 page. Opening the site in a browser and
looking at it took ten seconds and settled it the other way.

The house rule is "a green endpoint proves nothing about who can reach it". This
is the same rule with the status code inverted, and the lesson is the same one:
**look at the page.**
