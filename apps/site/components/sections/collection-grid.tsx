// Collection grid section — shop-by-collection tiles. Sources either the
// merchant's featured collections or a hand-picked list (order preserved).
// Async server component.

import Image from 'next/image';
import Link from 'next/link';

import type { CollectionGridConfig } from '@sparx/sitebuilder-schemas';

import { listCollections, type PublicCollection } from '@/lib/commerce';
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
    <section className="mx-auto w-full max-w-6xl px-6 py-16">
      {config.heading ? (
        <div className="mb-7 flex items-end justify-between gap-4">
          <h2 className="text-base-content text-3xl font-semibold tracking-tight">
            {config.heading}
          </h2>
        </div>
      ) : null}
      <div className={`grid grid-cols-1 gap-8 ${GRID_COLS[config.columns] ?? 'md:grid-cols-3'}`}>
        {collections.map((c) => {
          const hero = mediaUrl(c.heroMediaId, ctx.tenantSlug);
          return (
            <Link
              key={c.id}
              href={`/collections/${c.handle}`}
              className="group rounded-box bg-base-100 text-base-content focus-visible:outline-primary relative flex flex-col overflow-hidden no-underline transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <div className="bg-base-200 relative aspect-square overflow-hidden">
                {hero ? (
                  <Image
                    src={hero}
                    alt={c.name}
                    fill
                    sizes="(max-width: 860px) 50vw, 33vw"
                    className="object-cover transition-transform duration-[400ms] group-hover:scale-105"
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    className="bg-base-200 text-base-content/40 grid h-full w-full place-items-center"
                    aria-hidden="true"
                  >
                    <span style={{ fontSize: '2rem' }}>❖</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-[0.3rem] px-1 pt-[0.95rem] pb-2">
                <span className="text-base-content text-[0.98rem] leading-snug font-medium tracking-[-0.01em]">
                  {c.name}
                </span>
                {c.description ? <span className="text-base-content">{c.description}</span> : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
