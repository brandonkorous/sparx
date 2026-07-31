// SiteImage / EmbedFrame — the ratio-locked media leaves of a builder page.
//
// Both fill gaps silicaui doesn't cover (root CLAUDE.md RULE #1): it has `Mask`
// for clipping and `Hero` for a banner, but nothing that locks an image or an
// iframe to an aspect ratio and degrades to an accessible placeholder when it has
// no source — which is the state an unauthored builder node is in most of the
// time. Everything else is silica: the box radius, the base tones, the border.
//
// SERVER components — an `<img>` and an `<iframe>` need no client runtime.

import * as React from 'react';
import { cx } from '@wizeworks/silicaui-react/server';

export type ImageRatio = 'wide' | 'square' | 'portrait';
export type EmbedRatio = ImageRatio | 'pano';

const RATIO: Record<EmbedRatio, string> = {
  wide: 'aspect-video',
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  pano: 'aspect-[21/9]',
};

// ── Image ────────────────────────────────────────────────────────────────────

export interface SiteImageProps {
  src?: string;
  alt?: string;
  ratio?: ImageRatio;
  className?: string;
}

export function SiteImage({
  src,
  alt = '',
  ratio = 'wide',
  className,
}: SiteImageProps): React.ReactElement {
  const box = cx('rounded-box w-full object-cover', RATIO[ratio], className);
  // A plain <img>: media URLs 302-redirect to GCS, so next/image optimization
  // would only add a hop. Consistent with the rest of the storefront.
  if (src) return <img src={src} alt={alt} className={box} />;
  // No source — an accessible box in the right ratio, never a broken image.
  return <div role="img" aria-label={alt} className={cx('bg-base-200', box)} />;
}
SiteImage.displayName = 'SiteImage';

// ── EmbedFrame ───────────────────────────────────────────────────────────────

export interface EmbedFrameProps {
  src?: string;
  title: string;
  ratio?: EmbedRatio;
  /** Shown in the ratio box when there's no `src`. Defaults to `title`. */
  placeholder?: string;
  className?: string;
}

export function EmbedFrame({
  src,
  title,
  ratio = 'wide',
  placeholder,
  className,
}: EmbedFrameProps): React.ReactElement {
  const box = cx('rounded-box w-full overflow-hidden', RATIO[ratio], className);
  if (!src) {
    return (
      <div className={cx('bg-base-200 grid place-items-center text-sm', box)}>
        <span>{placeholder ?? title}</span>
      </div>
    );
  }
  return (
    <div className={box}>
      <iframe
        src={src}
        title={title}
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        className="h-full w-full border-0"
      />
    </div>
  );
}
EmbedFrame.displayName = 'EmbedFrame';
