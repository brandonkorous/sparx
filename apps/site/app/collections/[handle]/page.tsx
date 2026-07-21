// Collection detail = its products. Resolves the merchant's `collection`-scope
// layout (or the seeded default) and renders it through the shared
// SectionRenderer bound to this collection: a header section + a product-grid
// section (count + grid + pagination). Metadata + breadcrumbs are page chrome.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { Pagination } from '@/components/pagination';
import { SectionRenderer } from '@/components/section-renderer';
import { SilicaBody } from '@/components/silica-chrome';
import { getCollection, listCollectionProducts } from '@/lib/commerce';
import { getPublishedSilicaCollection } from '@/lib/silica';
import { buildSilicaHost, collectionToSilicaRecord } from '@/lib/silica-data';
import { mediaUrl } from '@/lib/media';
import { ogImageUrl } from '@/lib/og';
import {
  isSampleRequested,
  SAMPLE_COLLECTION,
  SAMPLE_COLLECTION_PRODUCTS,
} from '@/lib/sample-data';
import { getPublishedSite, resolveTemplateSections } from '@/lib/site';
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';
import { applyRedirect } from '@/lib/redirects';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ handle: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Products per page on a collection detail (docs/127 §8). Matches the category-detail
// core so the two record surfaces page identically; a real pager makes the whole
// collection reachable rather than truncating at a single generous page.
const COLLECTION_PER_PAGE = 24;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const site = await resolveSite();
  if (!site) return {};
  const { handle } = await params;
  const collection = await getCollection(site.slug, handle);
  if (!collection) return {};
  // Author-set OG, then the collection hero, then a tenant-branded generated
  // card (docs/50 §5) — so a collection always has a real social image.
  const image =
    mediaUrl(collection.ogImageId ?? collection.heroMediaId ?? null, site.slug) ??
    ogImageUrl({
      title: collection.seoTitle ?? collection.name,
      eyebrow: 'Collection',
      brand: site.name,
      accent: site.theme?.colorPrimary,
    });
  return {
    title: collection.seoTitle ?? collection.name,
    description: collection.seoDescription ?? collection.description ?? undefined,
    openGraph: {
      title: collection.seoTitle ?? collection.name,
      description: collection.seoDescription ?? collection.description ?? undefined,
      images: [{ url: image }],
    },
  };
}

export default async function CollectionDetailPage({ params, searchParams }: PageProps) {
  const site = await resolveSite();
  if (!site) notFound();
  const { handle } = await params;
  const sp = (await searchParams) ?? {};
  const page = Math.max(1, Number(one(sp.page) ?? '1') || 1);

  // Sample-data preview (doc 36 §9): token-gated `sparxSampleData=1` renders the
  // collection layout against fixed SAMPLE_* fixtures so it can be designed
  // before any real collection exists. The layout still resolves from the
  // (draft) snapshot — only the bound data is swapped.
  const sample = isSampleRequested(sp);
  const collection = sample ? SAMPLE_COLLECTION : await getCollection(site.slug, handle);
  if (!collection) {
    if (!sample) await applyRedirect(site.slug, `/collections/${handle}`);
    notFound();
  }

  // The silica engine's published `commerce.collection` template wins first (docs/118
  // Stage 6): it renders the collection through the shared silica walker — a header
  // over a grid of THIS collection's products, injected as the `collection` object
  // scope (with its products pre-fetched onto the record's `products` list, so the
  // grid never binds the whole catalog). Null → fall through to the legacy sections.
  // Preview sample-data keeps the legacy path. Bare, like the PDP — the silica frame
  // in the root layout provides the chrome.
  if (!sample) {
    const silicaTemplate = await getPublishedSilicaCollection(
      site.slug,
      'commerce.collection',
      collection.id
    );
    if (silicaTemplate) {
      // The collection's products, paged from the URL (docs/127 §8). The template's grid
      // repeats over `collection.products` (a scope-relative list), so binding it ONLY the
      // current page's items is what makes the grid page. The bind-based template can't
      // express a working SSR pager itself (the Pagination atom is presentational), so the
      // route renders a real link-based pager beneath the authored body — the same seam the
      // category-detail core uses. `?page=` varies this `force-dynamic` route, and each
      // page caches independently under the commerce product tag (not the builder tag).
      const { items, total, perPage } = await listCollectionProducts(
        site.slug,
        handle,
        page,
        COLLECTION_PER_PAGE
      );
      const totalPages = Math.max(1, Math.ceil(total / perPage));
      const host = await buildSilicaHost(site.slug, silicaTemplate.root, {
        record: {
          key: 'collection',
          value: collectionToSilicaRecord(collection, items, site.slug),
        },
        currency: site.commerce.defaultCurrency,
        locale: site.commerce.defaultLocale,
      });
      return (
        <>
          <SilicaBody root={silicaTemplate.root} symbols={silicaTemplate.symbols} host={host} />
          {totalPages > 1 ? (
            <div className="st-container">
              <Pagination
                basePath={`/collections/${handle}`}
                currentParams={sp}
                page={page}
                totalPages={totalPages}
              />
            </div>
          ) : null}
        </>
      );
    }
  }

  // The commerce:collection layout: the merchant's published one, or the seeded
  // default (parity). A site-preview token resolves the draft instead. In preview
  // only, `sparxLayoutKey` forces a specific alternate layout onto the canvas
  // (gated to the preview token — a public visitor can't pin a layout via query).
  const snapshot = await getPublishedSite(
    site.slug,
    one(sp.sparxSitePreview),
    (await resolveActivePropertySlug()) ?? undefined
  );
  const forcedKey = one(sp.sparxSitePreview) ? one(sp.sparxLayoutKey) : undefined;
  const sections = resolveTemplateSections(
    snapshot,
    'commerce:collection',
    collection.id,
    forcedKey
  );

  // Page size comes from the product-grid section's config (default 24 = today).
  const gridSection = sections.find((s) => s.sectionType === 'collection-products');
  const requestedPerPage =
    typeof gridSection?.config.perPage === 'number' ? gridSection.config.perPage : 24;

  const { items, total, perPage } = sample
    ? {
        items: SAMPLE_COLLECTION_PRODUCTS.slice(0, requestedPerPage),
        total: SAMPLE_COLLECTION_PRODUCTS.length,
        perPage: requestedPerPage,
      }
    : await listCollectionProducts(site.slug, handle, page, requestedPerPage);
  const { defaultCurrency: currency, defaultLocale: locale } = site.commerce;

  return (
    <div className="st-container">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Collections', href: '/collections' },
          { label: collection.name },
        ]}
      />

      <SectionRenderer
        sections={sections}
        ctx={{
          tenantSlug: site.slug,
          currency,
          locale,
          collection,
          collectionExtras: { items, total, page, perPage, currentParams: sp },
        }}
        definitions={snapshot?.definitions ?? []}
      />
    </div>
  );
}
