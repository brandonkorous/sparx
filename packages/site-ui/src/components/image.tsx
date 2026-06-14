// Image — a ratio-locked, cover-fit image with a graceful placeholder
// (docs/46 §5.2). SERVER component. Harvested from the site renderer's
// Image/ImageDisplay leaf: ratios wide 16/9, square 1/1, portrait 3/4; rounded
// to --st-radius-box. With no `src` it renders an accessible placeholder box
// (the unbound / empty state) instead of a broken image.

import * as React from 'react';
import { cx } from '../utils/cx';

export type ImageRatio = 'wide' | 'square' | 'portrait';

export interface ImageProps {
  src?: string;
  alt?: string;
  ratio?: ImageRatio;
  className?: string;
  style?: React.CSSProperties;
}

const RATIO_CLASS: Record<ImageRatio, string> = {
  wide: 'st-img--wide',
  square: 'st-img--square',
  portrait: 'st-img--portrait',
};

export function Image({ src, alt = '', ratio = 'wide', className, style }: ImageProps) {
  if (src) {
    // Plain <img>: media URLs 302-redirect to GCS; next/image optimization is a
    // later pass (consistent with the rest of the site).
    return (
      <img
        src={src}
        alt={alt}
        className={cx('st-img', RATIO_CLASS[ratio], className)}
        style={style}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={alt}
      className={cx('st-img', 'st-img--placeholder', RATIO_CLASS[ratio], className)}
      style={style}
    />
  );
}
Image.displayName = 'Image';
