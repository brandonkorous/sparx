'use client';

// HoverGallery — a main image that swaps to whichever thumbnail is hovered (docs/46
// §5.2). CLIENT component: genuine hover state (the same justification as Carousel).
// Falls back to the first image when nothing is hovered.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface HoverGalleryImage {
  src: string;
  alt?: string;
}

export interface HoverGalleryProps {
  images: HoverGalleryImage[];
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

export function HoverGallery({
  images,
  className,
  style,
  id,
}: HoverGalleryProps): React.ReactElement | null {
  const [active, setActive] = React.useState(0);
  if (images.length === 0) return null;
  const current = images[Math.min(active, images.length - 1)]!;

  return (
    <div className={cx('st-hovergallery', className)} style={style} id={id}>
      <div className="st-hovergallery__main">
        <img src={current.src} alt={current.alt ?? ''} className="st-hovergallery__img" />
      </div>
      {images.length > 1 ? (
        <div className="st-hovergallery__thumbs">
          {images.map((img, i) => (
            <button
              type="button"
              key={i}
              className={cx('st-hovergallery__thumb', i === active && 'st-hovergallery__thumb--on')}
              aria-label={img.alt ?? `Image ${i + 1}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
            >
              <img src={img.src} alt="" className="st-hovergallery__thumb-img" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
HoverGallery.displayName = 'HoverGallery';
