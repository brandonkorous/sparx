// Inline star-rating display. Pure presentational — renders filled/half/empty
// stars for an average rating plus the numeric value and review count. Used on
// the product detail page and (compactly) on cards.

import { Star, StarHalf } from 'lucide-react';

export function Stars({
  rating,
  reviewCount,
  size = 16,
}: {
  rating: number | null;
  reviewCount: number;
  size?: number;
}) {
  if (rating === null || reviewCount === 0) {
    return <span className="mx-rating">No reviews yet</span>;
  }

  const rounded = Math.round(rating * 2) / 2;
  const full = Math.floor(rounded);
  const hasHalf = rounded - full === 0.5;

  return (
    <span
      className="mx-rating"
      aria-label={`Rated ${rating.toFixed(1)} out of 5 from ${reviewCount} ${
        reviewCount === 1 ? 'review' : 'reviews'
      }`}
    >
      <span className="mx-rating__stars" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => {
          if (i < full) return <Star key={i} size={size} fill="currentColor" strokeWidth={0} />;
          if (i === full && hasHalf)
            return <StarHalf key={i} size={size} fill="currentColor" strokeWidth={0} />;
          return <Star key={i} size={size} className="opacity-30" strokeWidth={1.5} />;
        })}
      </span>
      <span>
        {rating.toFixed(1)} ({reviewCount.toLocaleString()})
      </span>
    </span>
  );
}
