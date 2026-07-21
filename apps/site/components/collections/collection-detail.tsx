// The collection DETAIL experience as ONE self-contained server component — the pinned
// `commerce.collection-detail` core (docs/122 + docs/127 §8). A collection is a flat,
// merchandised set of products: this shows the collection's header (hero + name +
// description) above its members as a FACETED, sortable, paginated grid — the same
// `ScopedProductBrowser` the PLP and category detail use, scoped to this collection. The
// /collections/[handle] route drops it into an editable silica shell via a host node, so a
// tenant surrounds the browse experience (intro copy, promos) without touching the
// facet/query logic. Self-contained: given the handle + search params, it resolves the
// collection and its filtered/sorted page itself.
//
// This replaced a bind-based flat grid that could only render one truncated page with no
// filters. Mirrors CategoryDetail (its browse-tree sibling) so the two detail surfaces
// read and behave consistently — header band, then the shared faceted browser.

import Image from 'next/image';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { ScopedProductBrowser, type SearchParams } from '@/components/products/scoped-product-browser';
import { getCollection } from '@/lib/commerce';
import { mediaUrl } from '@/lib/media';
import type { ResolvedSite } from '@/lib/site-context';

export async function CollectionDetail({
  site,
  handle,
  searchParams,
}: {
  site: ResolvedSite;
  handle: string;
  searchParams?: SearchParams;
}) {
  const sp = searchParams ?? {};

  const collection = await getCollection(site.slug, handle);
  if (!collection) {
    return <p className="st-muted">This collection isn’t available right now.</p>;
  }

  const hero = mediaUrl(collection.heroMediaId, site.slug);

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Collections', href: '/collections' },
          { label: collection.name },
        ]}
      />

      <header
        style={{
          position: 'relative',
          borderRadius: 'var(--st-radius-lg)',
          overflow: 'hidden',
          marginBottom: '2rem',
          background: hero ? undefined : 'var(--st-bg-subtle)',
        }}
      >
        {hero ? (
          <Image
            src={hero}
            alt=""
            aria-hidden="true"
            width={1280}
            height={260}
            priority
            sizes="100vw"
            style={{ width: '100%', height: '260px', objectFit: 'cover', display: 'block' }}
          />
        ) : null}
        <div
          style={{
            padding: hero ? '2rem' : '2.5rem 0',
            // Solid scrim (not a gradient) keeps overlaid text legible per the
            // no-gradients rule.
            ...(hero
              ? {
                  position: 'absolute',
                  inset: 'auto 0 0 0',
                  background: 'rgb(0 0 0 / 0.55)',
                  color: '#fff',
                }
              : {}),
          }}
        >
          <h1 className="st-h1" style={hero ? { color: '#fff' } : undefined}>
            {collection.name}
          </h1>
          {collection.description ? (
            <p style={{ marginTop: '0.5rem', maxWidth: '60ch', lineHeight: 1.6 }}>
              {collection.description}
            </p>
          ) : null}
        </div>
      </header>

      <ScopedProductBrowser
        site={site}
        searchParams={sp}
        basePath={`/collections/${collection.handle}`}
        scope={{ collection: collection.handle }}
      />
    </>
  );
}
