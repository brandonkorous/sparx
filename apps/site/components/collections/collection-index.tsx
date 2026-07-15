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
        <h1 className="st-h1">Collections</h1>
        <p className="st-muted" style={{ marginTop: '0.5rem' }}>
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
        <div className="st-grid st-grid--auto">
          {collections.map((c) => {
            const hero = mediaUrl(c.heroMediaId, site.slug);
            return (
              <Link key={c.id} href={`/collections/${c.handle}`} className="st-card">
                <div className="st-card__media">
                  {c.featured ? <span className="st-badge">Featured</span> : null}
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
      )}
    </>
  );
}
