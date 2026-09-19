// The denormalized rating a product page reads, recomputed FROM THE ROWS.
//
// ---------------------------------------------------------------------------
// The problem this exists for
// ---------------------------------------------------------------------------
//
// `Product.averageRating` / `Product.reviewCount` are a cache of the product's
// APPROVED reviews. Commerce owns them: `recomputeProductRating` in
// `review-service.ts` rewrites both inside the same transaction whenever the
// approved set changes, and its own comment says what happens otherwise —
// "the columns stay at their defaults (null / 0) and the PDP shows 'no reviews
// yet' no matter how many reviews are approved."
//
// The seeds cannot call it: `@wizeworks/db` may not import a module package. So
// both seeders wrote the columns by hand, and both got it wrong in a different
// way. Measured 2026-09-16 across 641 products:
//
//   • `prisma/seed.ts` wrote reviews and NEVER touched the columns. Five
//     products carry an approved review and report `reviewCount: 0`,
//     `averageRating: null` — a real review that the product page will not show.
//   • `sample-data/engine/reviews.ts` wrote them ROUNDED to one decimal, so
//     seven products store 4.7 where the service computes 4.666…. The two
//     disagree from the moment they are written, and the figure jumps the first
//     time anyone moderates a review on that product.
//   • Neither wrote the per-(product, site) rollup rows the per-site grids read,
//     so a seeded product shows its stars on the tenant-wide page and nothing on
//     a site page.
//
// One function, used by both, computing what the service computes: no rounding,
// null when there is nothing approved, and the per-site rows alongside. Two
// hand-written copies of one rule is how they drift; this is the chokepoint.

/** Just enough of a review for the arithmetic. */
export interface SeededReview {
  rating: number;
  status: string;
  /** The site the review was written on. `null` is the shared/legacy bucket. */
  propertyId?: string | null;
}

export interface ReviewRollup {
  /** `null` when nothing is approved — NOT 0. A product nobody has rated has no
   *  rating, and a stored 0 would render as one star. */
  averageRating: number | null;
  reviewCount: number;
  /** One row per site bucket, shaped for `commerce_product_review_rollups`. The
   *  table stores SUM and count rather than an average so two buckets can be
   *  added together without weighting them by hand. */
  bySite: { propertyId: string | null; sumRating: number; reviewCount: number }[];
}

/**
 * The rollup for one product's reviews.
 *
 * `approved` is the only status that counts, matching the service exactly. The
 * average is NOT rounded: rounding here is what put 4.7 in the column against
 * the 4.666… the service writes, and a figure that changes the first time
 * somebody moderates a review looks like a bug to whoever is watching it.
 */
export function reviewRollup(reviews: SeededReview[]): ReviewRollup {
  const approved = reviews.filter((r) => r.status === 'approved');
  if (approved.length === 0) return { averageRating: null, reviewCount: 0, bySite: [] };

  const sum = approved.reduce((total, r) => total + r.rating, 0);

  const buckets = new Map<string | null, { sumRating: number; reviewCount: number }>();
  for (const r of approved) {
    const key = r.propertyId ?? null;
    const at = buckets.get(key) ?? { sumRating: 0, reviewCount: 0 };
    at.sumRating += r.rating;
    at.reviewCount += 1;
    buckets.set(key, at);
  }

  return {
    averageRating: sum / approved.length,
    reviewCount: approved.length,
    bySite: [...buckets].map(([propertyId, at]) => ({ propertyId, ...at })),
  };
}
