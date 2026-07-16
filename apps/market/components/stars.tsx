// Inline read-only star-rating display. Pure presentational — renders
// filled/half/empty stars for an average rating plus (optionally) the numeric
// value and review count. silicaui's <Rating> is an INPUT (used on the
// write-review form); for fractional read-only display the lucide half-star reads
// cleaner, so this stays a small utility-composed primitive (no more mx-rating).

import { Star, StarHalf } from 'lucide-react';

export function Stars({
  rating,
  reviewCount,
  size = 16,
  compact = false,
}: {
  rating: number | null;
  reviewCount: number;
  /** Star glyph size in px. */
  size?: number;
  /** Cards: show just stars + count in parentheses (and nothing when unrated). */
  compact?: boolean;
}) {
  if (rating === null || reviewCount === 0) {
    if (compact) return null;
    return (
      <span className="text-base-content inline-flex items-center gap-1.5 text-sm">
        No reviews yet
      </span>
    );
  }

  const rounded = Math.round(rating * 2) / 2;
  const full = Math.floor(rounded);
  const hasHalf = rounded - full === 0.5;

  return (
    <span
      className="text-base-content inline-flex items-center gap-1.5 text-sm"
      aria-label={`Rated ${rating.toFixed(1)} out of 5 from ${reviewCount} ${
        reviewCount === 1 ? 'review' : 'reviews'
      }`}
    >
      <span className="text-warning inline-flex" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => {
          if (i < full) return <Star key={i} size={size} fill="currentColor" strokeWidth={0} />;
          if (i === full && hasHalf)
            return <StarHalf key={i} size={size} fill="currentColor" strokeWidth={0} />;
          return <Star key={i} size={size} className="opacity-25" strokeWidth={1.5} />;
        })}
      </span>
      {compact ? (
        <span className="text-base-content">({reviewCount.toLocaleString()})</span>
      ) : (
        <span>
          {rating.toFixed(1)} ({reviewCount.toLocaleString()})
        </span>
      )}
    </span>
  );
}
