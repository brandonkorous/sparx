# 544 — A real review the product page would not show

**Status:** fixed in code; seeds must be re-run for the existing rows
**Severity:** medium
**Found by:** a rollup sweep over all 641 products
**Surface:** `wizeworks/packages/db/src/seed-review-rollup.ts` (new), both seeders
**Filed:** 2026-09-16
**Family:** the stale-stored-word shape, seventh time this run

## Measured

`Product.averageRating` / `Product.reviewCount` cache a product's APPROVED
reviews. Compared against the review rows, over every product on the platform:

| products | wrong count | wrong average |
| -------- | ----------- | ------------- |
| 641      | **6**       | **13**        |

Three different faults behind those numbers:

| what                                                        | products |
| ----------------------------------------------------------- | -------- |
| an approved review, `reviewCount: 0`, `averageRating: null` | 5        |
| `reviewCount: 1` with no review rows behind it              | 1        |
| stored `4.7` where the service computes `4.666…`            | 7        |

The first is the one that costs something. Commerce's own recompute says exactly
what it means:

> _"Without this the columns stay at their defaults (null / 0) and the PDP shows
> 'no reviews yet' no matter how many reviews are approved."_

Five products have a real, approved, moderated review that their own page will
not show.

## Why

`recomputeProductRating` in `review-service.ts` owns these columns and is called
on every path that changes the approved set — create, moderate, delete, and the
bulk versions, which delegate. **The service is correct.**

The seeds cannot call it: `@wizeworks/db` may not import a module package. So
both seeders wrote the columns by hand, and each got it wrong differently:

- `prisma/seed.ts` wrote reviews and **never touched the columns at all**.
- `sample-data/engine/reviews.ts` wrote them **rounded to one decimal**, so the
  stored figure disagrees with the service from the moment it is written and
  jumps the first time anybody moderates a review on that product.
- **Neither** wrote the per-`(product, site)` rollup rows the per-site grids
  read, so a seeded product shows stars on the tenant-wide page and nothing on a
  site page.

Two hand-written copies of one rule is how they drift. This is issue 533's shape
again: work that must happen together, paired by convention across call sites.

## Fixed

One `reviewRollup()` in `@wizeworks/db`, used by both seeders: approved only, **no
rounding**, `null` rather than `0` when nothing is approved (a stored 0 renders as
one star, and no rating is not a bad rating), and the per-site buckets as SUM +
count alongside.

6 guards, living in **commerce** beside `recomputeProductRating`, because that is
the definition they have to agree with — `@wizeworks/db` has no test seat and may
not import a module package, so the rule ships from db and is guarded from the
package that owns the meaning. One guard asserts the all-sites figure equals the
buckets added together.

## Not repaired in place

The existing 6 rows are seed output. Re-running the seeds fixes them; no
migration is warranted for sample data, and Juniper Row is **not affected** (both
her products' ratings are correct).

## Files

- `wizeworks/packages/db/src/seed-review-rollup.ts` (new), `src/index.ts`
- `wizeworks/packages/db/prisma/seed.ts`, `src/sample-data/engine/reviews.ts`
- `wizeworks/packages/commerce/src/services/seed-review-rollup.test.ts` (new)
