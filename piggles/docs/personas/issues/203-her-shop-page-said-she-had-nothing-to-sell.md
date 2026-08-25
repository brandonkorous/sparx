# 203 — Her shop page said she had nothing to sell

**Status:** fixed and confirmed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 5
**Surface:** the tenant's website — Shop, every collection page, every category page
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 5, on screen, and re-checked on P01

## What happened

With **New in** saved and two garments in it, the page a shopper lands on read:

```
Shop
Everything we currently have available.

All products
0 products

    No products found
    Try adjusting your filters or search.
```

Not the collection. **The whole shop.** Seven garments in the console, three of
them on sale, and the front page of her business said she sells nothing. No
filter was set; there was nothing to adjust.

Every other Piggles site was the same. Thistle & Rye — a bakery with nine
products and a year of this run behind it — had an empty shop too.

## What should have happened

The shop shows the shop.

## Why it matters

There is no worse sentence to put on a shop. It is not an error a shopper reports
or retries; it reads as a finished, working website belonging to a business with
no stock, so they leave. Devi's whole reason for moving off the marketplace is
that her site IS her margin.

It is also the exact failure this project keeps re-finding, in a new place: **a
count nobody could measure, rendered as a measurement.** The page did not know
how many products she has. It said zero.

Personas RULE #8 says the website is the deliverable — and the deliverable was
blank for all ten businesses.

## Where it lives

[lib/commerce.ts](../../../../wizeworks/apps/site/lib/commerce.ts), `searchProducts`.

Product listings are **index-only**. The Shop, every collection page and every
category page all mount the same faceted browser, and that browser asks Typesense
through `/v1/public/commerce/search`. Nothing else is consulted:

```ts
} catch {
  // A search-backend hiccup — Typesense unavailable, or a tenant whose catalog is
  // not indexed yet — must NOT 500 the whole page. Degrade to an empty result…
  return { items: [], total: 0, … };
}
```

The comment names this case out loud, and the reasoning is right for the surface
it was written for and wrong for this one. On `/search?q=jacket`, "no results" is
a true answer. On `/shop` — the page whose entire job is _here is everything I
sell_ — it is a false statement about the business, produced by an outage.

Locally it is not even the catch: the index answers, it is just empty. Typesense
holds 6 documents and all six belong to integration-test fixtures
(`tenant-aaaaaaaa`, `tenant-bbbbbbbb`, `tenant-cccccccc`). No real tenant has ever
been indexed here, because the indexer is an event-worker handler and dev routes
events to a log — the same reason dev email is a no-op. So the endpoint returns a
perfectly successful `total: 0`:

```
/v1/public/commerce/search?tenant=juniper-row    → {"data":[],"total":0}
/v1/public/commerce/products?tenant=juniper-row  → her seven garments
```

The catalog was one endpoint away the whole time.

## The fix

**Nothing found is not the same as nothing to find.** A listing that comes back
empty — whether the index threw or answered zero — now asks the database before
telling a shopper the shop is empty.

`/v1/public/commerce/products` is the same catalog from Postgres. It already
takes the same `collection` and `category` scope, the same price window, the same
in-stock filter, and its own comment says its sort vocabulary _"mirrors
`SEARCH_SORT_BY` (the Typesense side) so the Postgres listing and the search index
sort identically"_. It returns the same card shape. So the page renders whole.

What the fallback cannot do is facets, typo tolerance, and the multi-value
selections the index handles — product-option tokens, fitment models, fitment
engines. **A listing narrowed by one of those falls back to nothing rather than to
a wrong answer**, because showing products that do not match the filter she chose
is worse than showing none.

This is a real repair, not a dev workaround: in production it is what stands
between a Typesense outage and every tenant's shop going blank, and it covers the
window after a bulk import while indexing catches up.

**What it does NOT fix, and is recorded rather than implied:** search itself, the
filter sidebar's facet counts, and typo tolerance still need the index, and the
index is still never built in local dev. Anything in this run that depends on
faceted search is **not checked**, not working.

## What it looked like once fixed

Her shop:

```
3 products
Linen Shirtdress $145.00 · Marlow Knit $96.00 · The Ash Overshirt $128.00
```

Three, not seven, and that is correct — the other four are not on sale yet. Each
card carries its photograph.

And **New in**, with her own sentence under the heading:

```
New in
The two new pieces this season. Both are made here in small runs, so when a
size goes it does not come back.

2 products
Linen Shirtdress $145.00 · The Ash Overshirt $128.00
```

## The neighbour check

This is shared spine, so per personas RULE #7 an earlier business was reopened:
**Thistle & Rye** (P01) now lists **9 products** with prices and Sold out badges
on a page that had been empty. The fix repaired the neighbour rather than
disturbing it.

## Rating effect

None — the storefront is not rated in [rating.md](../rating.md), which covers console
panes. Recorded in the run log of [03-juniper-row.md](../03-juniper-row.md).
