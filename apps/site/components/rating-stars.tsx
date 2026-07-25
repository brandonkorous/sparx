// Star rating display. Renders the silica Rating in read-only mode (gold
// `warning` stars) alongside an optional score/count. Pure presentation.

import { Rating } from '@wizeworks/silicaui-react';

export interface RatingStarsProps {
  rating: number; // 0–5
  count?: number;
  compact?: boolean;
}

export function RatingStars({ rating, count, compact }: RatingStarsProps) {
  const value = Math.max(0, Math.min(5, rating));
  return (
    <span className="text-base-content inline-flex items-center gap-1.5 text-sm">
      <Rating
        value={value}
        color="warning"
        size="sm"
        readOnly
        label={`Rated ${rating.toFixed(1)} out of 5`}
      />
      {!compact && count != null ? (
        <span>
          {rating.toFixed(1)} ({count})
        </span>
      ) : null}
      {compact && count != null ? <span>({count})</span> : null}
    </span>
  );
}
