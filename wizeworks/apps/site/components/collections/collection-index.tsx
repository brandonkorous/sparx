// The collection index experience as ONE self-contained server component — the pinned
// `commerce.collections` core (docs/122). It lists every published collection (featured
// first) as a card grid. The /collections route drops it into an editable silica shell
// via a host node, so a tenant surrounds the index (intro copy, promos) without touching
// the listing logic. Needs only the resolved site (no URL state).
//
// Extracted verbatim from the old app/collections/page.tsx body (only the outer container
// + breadcrumbs stayed on the route).

import Image from 'next/image';
import Link from 'next/link';

import { EmptyState } from '@/components/empty-state';
import { listCollections } from '@/lib/commerce';
import { mediaUrl } from '@/lib/media';
import type { ResolvedSite } from '@/lib/site-context';

export async function CollectionIndex({ site }: { site: ResolvedSite }) {
  const collections = await listCollections(site.slug);

  return (
    <>
      <header style={{ marginBottom: '2rem' }}>
        <h1 className="text-base-content text-4xl font-semibold tracking-tight">Collections</h1>
        <p className="text-base-content" style={{ marginTop: '0.5rem' }}>
          Curated lineups from {site.name}.
        </p>
      </header>

      {collections.length === 0 ? (
        <EmptyState
          icon="❖"
          title="No collections yet"
          description="Check back soon, or browse the full catalog."
          action={{ label: 'Shop all products', href: '/products' }}
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[clamp(1rem,2vw,1.75rem)]">
          {collections.map((c) => {
            const hero = mediaUrl(c.heroMediaId, site.slug);
            return (
              <Link
                key={c.id}
                href={`/collections/${c.handle}`}
                className="group rounded-box bg-base-100 text-base-content focus-visible:outline-primary relative flex flex-col overflow-hidden no-underline transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <div className="bg-base-200 relative aspect-square overflow-hidden">
                  {c.featured ? (
                    <span className="badge badge-neutral absolute top-3 left-3 z-10">Featured</span>
                  ) : null}
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
                      className="bg-base-200 text-base-content/40 grid h-full place-items-center text-[2rem]"
                      aria-hidden="true"
                    >
                      ❖
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 px-1 pt-4 pb-2">
                  <span className="text-base-content text-base leading-snug font-medium">
                    {c.name}
                  </span>
                  {c.description ? (
                    <span className="text-base-content text-sm">{c.description}</span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
