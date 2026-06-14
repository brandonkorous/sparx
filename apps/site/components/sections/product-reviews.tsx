// Bound product section — rating summary + the list of approved reviews +
// write-a-review form. The reviews are server-fetched on the PDP and handed in
// via ctx.productExtras.reviews (same pattern as the Q&A section). Each review
// shows its rating, author, optional title, body, a verified-purchase badge,
// and any merchant response.

import type { ProductReviewsConfig } from '@sparx/sitebuilder-schemas';

import { RatingStars } from '@/components/rating-stars';
import { ReviewForm } from '@/components/review-form';
import type { PublicReview } from '@/lib/commerce';
import type { SectionContext } from '../section-renderer';

function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

function ReviewCard({ review }: { review: PublicReview }) {
  return (
    <li className="st-review">
      <div className="st-review__head">
        <RatingStars rating={review.rating} compact />
        {review.author ? <span className="st-review__author">{review.author}</span> : null}
        {review.verifiedPurchase ? (
          <span className="st-review__verified">Verified purchase</span>
        ) : null}
        <span className="st-review__date st-muted">{formatReviewDate(review.createdAt)}</span>
      </div>
      {review.title ? <p className="st-review__title">{review.title}</p> : null}
      <p className="st-review__body">{review.body}</p>
      {review.response ? (
        <div className="st-review__response">
          <strong>Store response</strong>
          <p>{review.response}</p>
        </div>
      ) : null}
      {review.helpfulCount > 0 ? (
        <p className="st-review__helpful st-muted">
          {review.helpfulCount} {review.helpfulCount === 1 ? 'person' : 'people'} found this helpful
        </p>
      ) : null}
    </li>
  );
}

export function ProductReviewsSection({
  config,
  ctx,
}: {
  config: ProductReviewsConfig;
  ctx: SectionContext;
}) {
  const product = ctx.product;
  if (!product) return null;

  const reviews = ctx.productExtras?.reviews;
  // Prefer the live list summary (always current) over the product's
  // denormalized columns; fall back to the product when the list didn't load.
  const total = reviews?.summary.total ?? product.reviewCount;
  const average = reviews?.summary.averageRating ?? product.averageRating ?? 0;
  const items = reviews?.items ?? [];

  return (
    <section className="st-section">
      <h2 className="st-h2" style={{ marginBottom: '1rem' }}>
        {config.heading}
      </h2>
      {total > 0 ? (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}
        >
          <RatingStars rating={average} count={total} />
        </div>
      ) : (
        <p className="st-muted" style={{ marginBottom: '1.25rem' }}>
          {config.emptyText}
        </p>
      )}

      {items.length > 0 ? (
        <ul className="st-reviews" style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem' }}>
          {items.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </ul>
      ) : null}

      {config.showForm ? <ReviewForm tenantSlug={ctx.tenantSlug} handle={product.handle} /> : null}
    </section>
  );
}
