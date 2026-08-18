// Testimonials section — social-proof cards with an optional avatar and star
// rating. Columns come from config; rows wrap responsively below.

import Image from 'next/image';

import type { TestimonialsConfig } from '@wizeworks/sitebuilder-schemas';

import { RatingStars } from '@/components/rating-stars';
import { mediaUrl } from '@/lib/media';
import type { SectionContext } from '../section-renderer';

// Fixed-column grid at md+ (mobile stays single-column). Literal class strings so
// Tailwind emits them.
const GRID_COLS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
};

export function TestimonialsSection({
  config,
  ctx,
}: {
  config: TestimonialsConfig;
  ctx: SectionContext;
}) {
  const items = config.items.filter((t) => t.quote);
  if (items.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16">
      {config.heading ? (
        <div className="mb-7 flex items-end justify-between gap-4">
          <h2 className="text-base-content text-3xl font-semibold tracking-tight">
            {config.heading}
          </h2>
        </div>
      ) : null}
      <div className={`grid grid-cols-1 gap-8 ${GRID_COLS[config.columns] ?? 'md:grid-cols-3'}`}>
        {items.map((t, i) => {
          const avatar = mediaUrl(t.avatarMediaId ?? null, ctx.tenantSlug);
          return (
            <figure
              key={i}
              className="rounded-box border-base-300 bg-base-100 m-0 grid gap-[0.85rem] border p-6"
            >
              {typeof t.rating === 'number' ? <RatingStars rating={t.rating} compact /> : null}
              <blockquote className="text-base-content m-0 text-[1.05rem] leading-normal">
                {t.quote}
              </blockquote>
              <figcaption className="text-base-content flex items-center gap-[0.65rem] text-[0.9rem]">
                {avatar ? (
                  <Image
                    className="h-9 w-9 rounded-full object-cover"
                    src={avatar}
                    alt=""
                    width={36}
                    height={36}
                    style={{ objectFit: 'cover' }}
                  />
                ) : null}
                <span>
                  {t.authorName ? <strong>{t.authorName}</strong> : null}
                  {t.authorTitle ? (
                    <span className="text-base-content"> · {t.authorTitle}</span>
                  ) : null}
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
