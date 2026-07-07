'use client';

// PDP image gallery. A client island: a large primary image plus a thumbnail
// strip that swaps the active image. Falls back to the single card image when the
// product has no multi-image gallery, and to a placeholder when it has none.

import { useState } from 'react';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { cx } from 'silicaui-react/server';

import type { ListingImage } from '@/lib/market';

export function ProductGallery({
  images,
  fallbackUrl,
  title,
}: {
  images: ListingImage[];
  fallbackUrl: string | null;
  title: string;
}) {
  const gallery: ListingImage[] =
    images.length > 0 ? images : fallbackUrl ? [{ url: fallbackUrl, alt: title }] : [];
  const [active, setActive] = useState(0);

  if (gallery.length === 0) {
    return (
      <div className="bg-base-200 text-base-content/50 flex aspect-square items-center justify-center rounded-xl">
        <ImageOff size={48} aria-hidden />
      </div>
    );
  }

  const index = Math.min(active, gallery.length - 1);
  const current = gallery[index]!;

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-base-200 relative aspect-square overflow-hidden rounded-xl">
        <Image
          src={current.url}
          alt={current.alt ?? title}
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      {gallery.length > 1 ? (
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {gallery.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1} of ${gallery.length}`}
              aria-current={i === index}
              className={cx(
                'relative aspect-square overflow-hidden rounded-lg border-2 transition-colors',
                i === index ? 'border-primary' : 'hover:border-base-content/20 border-transparent'
              )}
            >
              <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
