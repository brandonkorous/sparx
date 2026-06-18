// Testimonials section — social-proof cards with an optional avatar and star
// rating. Columns come from config; rows wrap responsively below.

import Image from 'next/image';

import type { TestimonialsConfig } from '@sparx/sitebuilder-schemas';

import { RatingStars } from '@/components/rating-stars';
import { mediaUrl } from '@/lib/media';
import type { SectionContext } from '../section-renderer';

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
    <section className="st-container st-section">
      {config.heading ? (
        <div className="st-section__head">
          <h2 className="st-h2">{config.heading}</h2>
        </div>
      ) : null}
      <div className={`st-grid st-grid--cols-${config.columns} st-grid--gap-lg`}>
        {items.map((t, i) => {
          const avatar = mediaUrl(t.avatarMediaId ?? null, ctx.tenantSlug);
          return (
            <figure key={i} className="st-sb-quote">
              {typeof t.rating === 'number' ? <RatingStars rating={t.rating} compact /> : null}
              <blockquote className="st-sb-quote__text">{t.quote}</blockquote>
              <figcaption className="st-sb-quote__by">
                {avatar ? (
                  <Image
                    className="st-sb-quote__avatar"
                    src={avatar}
                    alt=""
                    width={36}
                    height={36}
                    style={{ objectFit: 'cover' }}
                  />
                ) : null}
                <span>
                  {t.authorName ? <strong>{t.authorName}</strong> : null}
                  {t.authorTitle ? <span className="st-muted"> · {t.authorTitle}</span> : null}
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
