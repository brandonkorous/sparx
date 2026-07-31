'use client';

// HoverGallery — a main image that swaps to whichever thumbnail is hovered.
//
// One of the sparx components filling a gap in silicaui (root CLAUDE.md RULE #1).
// CLIENT component, because the hovered index is genuine state: CSS alone can
// style the thumb under the cursor but cannot tell the MAIN image which one that
// is. Focus drives it too, so the gallery works from the keyboard.
//
// Everything visual is silica: the frame rounds with `rounded-box`, the active
// thumb is marked with the real `border-primary` token, and the rest is layout.

import * as React from 'react';
import { cx } from '@wizeworks/silicaui-react/server';

export interface HoverGalleryImage {
  src: string;
  alt?: string;
}

export interface HoverGalleryProps {
  images: HoverGalleryImage[];
  className?: string;
  id?: string;
}

export function HoverGallery({
  images,
  className,
  id,
}: HoverGalleryProps): React.ReactElement | null {
  const [active, setActive] = React.useState(0);
  if (images.length === 0) return null;
  const current = images[Math.min(active, images.length - 1)]!;

  return (
    <div className={cx('flex flex-col gap-3', className)} id={id}>
      <div className="bg-base-200 rounded-box aspect-[4/3] w-full overflow-hidden">
        <img src={current.src} alt={current.alt ?? ''} className="h-full w-full object-cover" />
      </div>
      {images.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <button
              type="button"
              key={i}
              className={cx(
                'rounded-field size-16 overflow-hidden border-2 transition-colors',
                i === active ? 'border-primary' : 'border-base-300'
              )}
              aria-label={img.alt ?? `Image ${i + 1}`}
              aria-pressed={i === active}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
            >
              <img src={img.src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
HoverGallery.displayName = 'HoverGallery';
