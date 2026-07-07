'use client';

// A heart toggle that saves a product to the guest favorites list (localStorage).
// A client island overlaid on product cards + the PDP. Renders nothing meaningful
// on the server (favorites are client-only), so it hydrates to the stored state.

import { Heart } from 'lucide-react';

import { useIsFavorite } from '@/lib/favorites-client';

export function FavoriteButton({
  slug,
  title,
  className,
  size = 18,
}: {
  slug: string;
  title: string;
  className?: string;
  size?: number;
}) {
  const [favorited, toggle] = useIsFavorite(slug);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      aria-pressed={favorited}
      aria-label={favorited ? `Remove ${title} from favorites` : `Save ${title} to favorites`}
      title={favorited ? 'Saved to favorites' : 'Save to favorites'}
      className={`inline-flex items-center justify-center rounded-full border border-[var(--color-border-default)] bg-[color-mix(in_oklch,var(--color-bg-surface)_88%,transparent)] p-2 backdrop-blur-sm transition-colors hover:border-[var(--color-border-strong)] ${
        favorited
          ? 'text-[var(--color-danger)]'
          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
      } ${className ?? ''}`}
    >
      <Heart size={size} aria-hidden fill={favorited ? 'currentColor' : 'none'} />
    </button>
  );
}
