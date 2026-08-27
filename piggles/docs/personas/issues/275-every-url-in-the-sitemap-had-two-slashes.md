# 275 — Four of the site's URLs went into the sitemap with two slashes

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · RULE #8 — checking the sitemap, then checking
another tenant's to be sure
**Surface:** `GET /v1/sitemap.xml`
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

Juniper Row's own sitemap was clean, so this was found by reading a second
tenant's. Circuit Byte's, in full:

```
https://circuit-byte.sparx.zone/
https://circuit-byte.sparx.zone//          ←
https://circuit-byte.sparx.zone//shop      ←
https://circuit-byte.sparx.zone//about     ←
https://circuit-byte.sparx.zone//contact   ←
https://circuit-byte.sparx.zone/products
…
```

Their home page is advertised twice, and their Shop, About and Contact are
advertised **only** in a form that is not their address. Eight tenants in this
database were shipping the doubled form; the four above are Circuit Byte's, and
Everson Apparel and Harbor Pine each had thirteen.

## Why it survived

Because it works. Each doubled URL 308s to the single-slash one:

```
//shop   → 308 → /shop
//       → 308 → /
```

So no visitor sees a fault, no log records an error, and nothing on any screen
says anything. What it costs is the thing a sitemap is for: a document whose
whole job is to name the canonical URL of every page, naming a redirect for
four of them. A crawler is told a URL is canonical and then told it is not, and
the home page arrives twice under two names.

## Where it lives

Two spellings of a slug are in the store and always have been — a blueprint
writes `about`, the code starter writes `/about` — and
[sitemap.ts](../../../../wizeworks/services/api-rest/src/routes/v1/sitemap.ts)
built its path as:

```ts
push({ path: `/${b.slug}`, … })
```

Every other reader already knew about the two spellings. `isUtilityPage` and
`isRecordAddress` both normalize; site-lint's `addressOf` folds them together;
`isHomeRow` in the builder matches all three spellings and carries a comment
about the cost of matching only one. This one line was the reader that did not.

## The fix

`pageAddress` in
[sitemap-urls.ts](../../../../wizeworks/services/api-rest/src/lib/sitemap-urls.ts),
used for every page path the document emits. One line of behaviour, extracted
with the rest of "which addresses does this site advertise" into a module of its
own so it can be tested without a database — which is what
`sitemap-urls.test.ts` now does, including a check that no address it produces
ever starts with two slashes.

Proved red by putting the old expression back:

```
AssertionError: expected '//about' to be '/about'
AssertionError: pageAddress("/"): expected '//' not to match /^\/\//
```

## Found alongside, and fixed in the same pass

**Categories were in no sitemap at all.** `/category/{handle}` is a real,
indexable page and not one of them was advertised, for any tenant. They are now
— filtered to the categories that actually hold an active product, which
collections deliberately are not: a collection is a thing a merchant made and
named, so an empty one is a page they are about to fill, while a category tree
arrives with the blueprint.

Juniper Row is why that filter exists. She has eighteen categories, and **every
one of them is empty** — the only products ever filed in them were the
blueprint's samples, and she deleted those weeks ago. All eighteen still answer
200, each with a heading, a breadcrumb, and "No products found. Try adjusting
your filters or search" over no filters. A womenswear label serving a Kids page.
Advertising those to Google would have been worse than the omission.

## Why nobody had looked

Because on a developer's machine nobody CAN. `wizeworks/apps/site`'s proxy is what
turns `?tenant=<slug>` into the header the resolver reads — there is no per-tenant
DNS locally, which is the entire reason that override exists — and its matcher
excluded `robots.txt`, `sitemap.xml` and `favicon.ico`. So
`localhost:3004/sitemap.xml?tenant=juniper-row` answered a flat `Not found`, and
`robots.txt` answered `Disallow: /`. Three routes that exist to be read, unreadable
on the only machine anyone reads them on.

They are in the matcher now. In production the change runs the other way and is also
wanted: the proxy STRIPS a client-supplied `x-tenant-slug` on every real host, and
these three paths were the only ones exempt from that.

## The other half

The pages themselves — an index advertising five dead ends, and an empty
category telling a shopper to adjust filters they never set — are
[276](276-every-aisle-in-her-shop-led-to-an-empty-room.md), fixed in the same
pass. This issue is only about the document the crawler reads.

## Confirmed

```
before   /  //  //shop  //about  //contact  /products  …
after    /  /about  /blog  /contact  /privacy-policy  /products  /shop  …
```

Every URL single-slashed, the home page once, nothing removed that was reachable.
406 api-rest tests pass, 8 of them new.

## Related

[[feedback_structural_checks_go_blind]] — the family, if not the letter: a
document nobody reads is a check nobody runs. Three tenants had been publishing
this for as long as they have had sitemaps.

## Rating effect

Recorded in the run log of [03-juniper-row.md](../03-juniper-row.md). No pane
score changes — this surface has no screen.
