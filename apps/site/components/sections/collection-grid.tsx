// Collection grid section — shop-by-collection tiles. Sources either the
// merchant's featured collections or a hand-picked list (order preserved).
// Async server component.

import Image from 'next/image';
import Link from 'next/link';

import type { CollectionGridConfig } from '@sparx/sitebuilder-schemas';

import { listCollections, type PublicCollection } from '@/lib/commerce';
import { mediaUrl } from '@/lib/media';
import type { SectionContext } from '../section-renderer';

function resolveCollections(
  config: CollectionGridConfig,
  all: PublicCollection[]
): PublicCollection[] {
  if (config.source === 'manual') {
    const byId = new Map(all.map((c) => [c.id, c]));
    return config.collectionIds
      .flatMap((id) => {
        const c = byId.get(id);
        return c ? [c] : [];
      })
      .slice(0, config.limit);
  }
  return all.filter((c) => c.featured).slice(0, config.limit);
}

export async function CollectionGridSection({
  config,
  ctx,
}: {
  config: CollectionGridConfig;
  ctx: SectionContext;
}) {
  const all = await listCollections(ctx.tenantSlug).catch(() => [] as PublicCollection[]);
  const collections = resolveCollections(config, all);
  if (collections.length === 0) return null;

  return (
    <section className="st-container st-section">
      {config.heading ? (
        <div className="st-section__head">
          <h2 className="st-h2">{config.heading}</h2>
        </div>
      ) : null}
      <div className={`st-grid st-grid--cols-${config.columns} st-grid--gap-lg`}>
        {collections.map((c) => {
          const hero = mediaUrl(c.heroMediaId, ctx.tenantSlug);
          return (
            <Link key={c.id} href={`/collections/${c.handle}`} className="st-card">
              <div className="st-card__media">
                {hero ? (
                  <Image
                    src={hero}
                    alt={c.name}
                    fill
                    sizes="(max-width: 860px) 50vw, 33vw"
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <div className="st-card__media st-card__media--empty" aria-hidden="true">
                    <span style={{ fontSize: '2rem' }}>❖</span>
                  </div>
                )}
              </div>
              <div className="st-card__body">
                <span className="st-card__title">{c.name}</span>
                {c.description ? <span className="st-muted">{c.description}</span> : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
