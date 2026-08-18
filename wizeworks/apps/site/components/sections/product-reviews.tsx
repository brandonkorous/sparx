// Bound product section — rating summary + the list of approved reviews +
// write-a-review form. The reviews are server-fetched on the PDP and handed in
// via ctx.productExtras.reviews (same pattern as the Q&A section). Each review
// shows its rating, author, optional title, body, a verified-purchase badge,
// and any merchant response.

import type { ProductReviewsConfig } from '@wizeworks/sitebuilder-schemas';

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
    <li className="border-base-300 border-b py-[1.1rem] first:pt-0">
      <div className="mb-2 flex flex-wrap items-center gap-2.5">
        <RatingStars rating={review.rating} compact />
        {review.author ? (
          <span className="text-base-content font-semibold">{review.author}</span>
        ) : null}
        {review.verifiedPurchase ? (
          <span className="badge badge-primary badge-sm">Verified purchase</span>
        ) : null}
        <span className="text-base-content ml-auto text-sm">
          {formatReviewDate(review.createdAt)}
        </span>
      </div>
      {review.title ? <p className="text-base-content mb-1 font-semibold">{review.title}</p> : null}
      <p className="text-base-content m-0 leading-relaxed">{review.body}</p>
      {review.response ? (
        <div className="rounded-field border-primary bg-base-200 mt-3 border-l-[3px] px-3.5 py-2.5">
          <strong className="text-base-content mb-1 block text-[0.78rem] tracking-wide uppercase">
            Store response
          </strong>
          <p className="text-base-content m-0 leading-normal">{review.response}</p>
        </div>
      ) : null}
      {review.helpfulCount > 0 ? (
        <p className="text-base-content mt-2.5 text-sm">
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
    <section className="py-16">
      <h2 className="text-base-content mb-4 text-3xl font-semibold tracking-tight">
        {config.heading}
      </h2>
      {total > 0 ? (
        <div className="mb-5 flex items-center gap-4">
          <RatingStars rating={average} count={total} />
        </div>
      ) : (
        <p className="text-base-content mb-5">{config.emptyText}</p>
      )}

      {items.length > 0 ? (
        <ul className="m-0 mb-6 list-none p-0">
          {items.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </ul>
      ) : null}

      {config.showForm ? <ReviewForm tenantSlug={ctx.tenantSlug} handle={product.handle} /> : null}
    </section>
  );
}
