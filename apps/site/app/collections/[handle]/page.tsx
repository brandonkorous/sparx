// Collection detail — an EDITABLE shell around a PINNED `commerce.collection-detail` core
// (docs/122 + docs/127 §8). The core renders the collection's header + its members as a
// FACETED, sortable, paginated grid (the same browser the PLP + category detail use,
// scoped to this collection), so a large collection is genuinely shoppable rather than a
// single truncated page. The route keeps the record lookup + the 404/redirect guard and
// mounts the core with the collection handle; the tenant's published `commerce.collection`
// template (or the code fallback) is the shell around it. The sample-data preview keeps the
// legacy section renderer, so a collection layout can be designed before a real one exists.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { collectionDetailPage } from '@sparx/silica-catalog';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { SectionRenderer } from '@/components/section-renderer';
import { SilicaFunctionalBody } from '@/components/silica-chrome';
import { storefrontHostRenderer } from '@/components/silica-host-cores';
import { getCollection } from '@/lib/commerce';
import { getPublishedSilicaCollection } from '@/lib/silica';
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

  const sample = isSampleRequested(sp);

  // Live path: the functional `commerce.collection-detail` core inside the tenant's
  // editable shell (published template → type default → code fallback). The core renders
  // the header + the faceted, sorted, paged member grid from the handle + search params.
  if (!sample) {
    const collection = await getCollection(site.slug, handle);
    if (!collection) {
      await applyRedirect(site.slug, `/collections/${handle}`);
      notFound();
    }
    const propertySlug = await resolveActivePropertySlug();
    const published = await getPublishedSilicaCollection(
      site.slug,
      'commerce.collection',
      collection.id
    );
    const shell = published?.root ?? collectionDetailPage();
    const renderHost = storefrontHostRenderer({
      site,
      propertySlug: propertySlug ?? undefined,
      recordHandle: handle,
      searchParams: sp,
    });
    return (
      <div className="mx-auto w-full max-w-6xl px-6">
        <SilicaFunctionalBody root={shell} symbols={published?.symbols} renderHost={renderHost} />
      </div>
    );
  }

  // Sample-data preview (doc 36 §9): token-gated `sparxSampleData=1` renders the collection
  // layout against fixed SAMPLE_* fixtures through the legacy section renderer, so it can be
  // designed before any real collection exists.
  const collection = SAMPLE_COLLECTION;
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
  const items = SAMPLE_COLLECTION_PRODUCTS.slice(0, requestedPerPage);
  const total = SAMPLE_COLLECTION_PRODUCTS.length;
  const { defaultCurrency: currency, defaultLocale: locale } = site.commerce;

  return (
    <div className="mx-auto w-full max-w-6xl px-6">
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
          collectionExtras: { items, total, page: 1, perPage: requestedPerPage, currentParams: sp },
        }}
        definitions={snapshot?.definitions ?? []}
      />
    </div>
  );
}
