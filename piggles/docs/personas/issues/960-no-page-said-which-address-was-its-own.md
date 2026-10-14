# 960 — No page said which address was its own

**Status:** fixed (act 8)
**Severity:** major
**Found by:** P09 · The Marrow Review · act 8
**Surface:** every site: every page's head, and its structured data
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · act 8, "Who pays when the malting barley fails"
**Blocked on:** —

## What happened

Her piece's head had a title, a description, a share card and three blocks of structured
data (the facts a search engine reads about the page). It had no canonical link: the tag
that tells a search engine which one address is the page's own. No page on her site had
one, unless its owner typed an address into "Preferred web address".

A site answers at its own subdomain, at a custom domain once one is connected, and with
any query a link carries (`?utm_source=`, the share trackers). Without the tag a search
engine meets one piece at several addresses and decides on its own which to list.

The structured data disagreed with itself too:

- The piece's `mainEntityOfPage` named `https://localhost:3004/...`: the host that
  served the page, with `https://` put in front. On a plain-http host that address does
  not answer. On a second host it names a second address for one piece.
- The site's `Organization` named `http://localhost:3004`. Her sitemap names
  `https://the-marrow-review.piggles.site`. Three blocks, two addresses.
- `sameAs`, the list of the business's social profiles, was built with
  `Object.values(site.socials)`. `socials` is a list of `{ platform, url }`, so a site
  with profiles sent the objects themselves where search engines want a list of URLs.

## The fix

- `api-rest` `public/content.ts`: the site payload carries `siteOrigin`, from
  `canonicalSiteHost`, the helper the sitemap and the feed already use.
- `apps/site/lib/canonical.ts` (new): `canonicalUrl(origin, path, page)`. The path
  without a trailing slash, and `?page=N` past page 1. Every other query is dropped.
- `proxy.ts` passes `?page=` to the layout as `x-sparx-page`. `app/layout.tsx` gives
  every page a canonical link on `siteOrigin`. A page whose owner typed a "Preferred web
  address" keeps it.
- `layout.tsx` (`Organization`, `WebSite`) and `article-json-ld.tsx` name `siteOrigin`.
  `sameAs` is the profiles' URLs.

## Proof

- `canonical.test.ts`, 3: the site's host; one address with or without a trailing
  slash; the page number past page 1 and nothing else. With the helper returning the raw
  path, 2 redden.
- Her piece, opened with `?utm_source=x`: canonical, `mainEntityOfPage` and
  `Organization` all name `https://the-marrow-review.piggles.site`. Home, `/about`,
  `/authors/rosalind-pike` and `/archive?page=2` name themselves on that host.
- Site tests 415 pass; api-rest `lib` and `public` 468 pass.
