import { describe, expect, it } from 'vitest';
import { reviewRollup } from '@wizeworks/db';

/**
 * A REAL REVIEW THAT THE PRODUCT PAGE WILL NOT SHOW.
 *
 * `Product.averageRating` / `reviewCount` cache the product's approved reviews,
 * and commerce's `recomputeProductRating` owns them. The seeds cannot call it
 * (`@wizeworks/db` may not import a module package), so both wrote the columns
 * by hand and both got it wrong, differently.
 *
 * Measured 2026-09-16 over 641 products:
 *
 *   5 products   an approved review, `reviewCount: 0`, `averageRating: null`
 *                (prisma/seed.ts never wrote the columns at all)
 *   7 products   stored 4.7 where the service computes 4.666…
 *                (sample-data rounded to one decimal)
 *   1 product    `reviewCount: 1` with no review rows behind it
 *
 * The service's own comment says what the first one costs: "the columns stay at
 * their defaults (null / 0) and the PDP shows 'no reviews yet' no matter how
 * many reviews are approved."
 *
 * The test lives HERE, beside `recomputeProductRating`, because that is the
 * definition this has to agree with. `@wizeworks/db` has no test seat and may
 * not import a module package, so the rule ships from db and is guarded from
 * the package that owns the meaning.
 */
describe('reviewRollup', () => {
  const r = (rating: number, status = 'approved', propertyId: string | null = null) => ({
    rating,
    status,
    propertyId,
  });

  it('counts only approved reviews', () => {
    const roll = reviewRollup([r(5), r(1, 'pending'), r(1, 'rejected'), r(3)]);
    expect(roll.reviewCount).toBe(2);
    expect(roll.averageRating).toBe(4);
  });

  it('does NOT round the average', () => {
    // 4.7 in the column against 4.666… from the service is a figure that jumps
    // the first time anybody moderates a review on this product.
    const roll = reviewRollup([r(5), r(5), r(4)]);
    expect(roll.averageRating).toBeCloseTo(14 / 3, 10);
    expect(roll.averageRating).not.toBe(4.7);
  });

  it('gives a product with nothing approved a NULL rating, never zero', () => {
    // A stored 0 renders as one star. No rating is not a bad rating.
    const roll = reviewRollup([r(5, 'pending'), r(4, 'flagged')]);
    expect(roll.averageRating).toBeNull();
    expect(roll.reviewCount).toBe(0);
    expect(roll.bySite).toEqual([]);
  });

  it('handles a product with no reviews at all', () => {
    expect(reviewRollup([])).toEqual({ averageRating: null, reviewCount: 0, bySite: [] });
  });

  it('splits the per-site rollup into sums and counts, not averages', () => {
    const roll = reviewRollup([r(5, 'approved', 'site-a'), r(3, 'approved', 'site-a'), r(4)]);
    const bySite = new Map(roll.bySite.map((b) => [b.propertyId, b]));
    expect(bySite.get('site-a')).toEqual({ propertyId: 'site-a', sumRating: 8, reviewCount: 2 });
    // A review written with no site lands in the shared bucket rather than being
    // dropped or counted under every site.
    expect(bySite.get(null)).toEqual({ propertyId: null, sumRating: 4, reviewCount: 1 });
  });

  it('keeps the all-sites figure equal to the buckets added together', () => {
    const roll = reviewRollup([r(5, 'approved', 'a'), r(2, 'approved', 'b'), r(4)]);
    const sum = roll.bySite.reduce((t, b) => t + b.sumRating, 0);
    const n = roll.bySite.reduce((t, b) => t + b.reviewCount, 0);
    expect(n).toBe(roll.reviewCount);
    expect(sum / n).toBeCloseTo(roll.averageRating ?? 0, 10);
  });
});
