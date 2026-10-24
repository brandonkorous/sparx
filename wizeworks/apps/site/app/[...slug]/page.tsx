// Catch-all page route. Joins the URL path segments with `/` and looks up
// a `page`-typed CMS entry with that slug under the tenant resolved from
// the Host header. Honors `?sparxPreview=<token>` for draft access.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { resolveActivePropertySlug, resolveSite, type ResolvedSite } from '@/lib/site-context';
import { SUSPENDED_METADATA } from '@/lib/suspended';
import { getPageBySlug } from '@/lib/content';
import { applyRedirect } from '@/lib/redirects';
import { getPublishedSite, sectionsForPage } from '@/lib/site';
import { getPublishedBuilderPage } from '@/lib/builder';
import { getPublishedSilicaPage } from '@/lib/silica';
import { requireSiteModule } from '@/lib/site-modules';
import { getKindPiece } from '@/lib/kind-pieces';
import { joinSlug, unservableSlug } from '@/lib/unservable-slug';
import { authoredPageMetadata, cmsPageMetadata, NOT_FOUND_METADATA } from '@/lib/slug-metadata';
import { KindPiecePage, kindPieceMetadata } from '@/components/kind-piece-page';
import { PageView } from '@/components/page-view';
import { SectionRenderer } from '@/components/section-renderer';
import { BuilderSlugPage, SilicaSlugPage } from './authored-page';

// NO `force-dynamic` (docs/127 §6): data stays cached and purged on publish; the Host read keeps it per-request.

interface SlugPageProps {
  params: Promise<{ slug: string[] }>;
  // The full URL params: an embedded host core (the faceted PLP on /shop) reads facet/sort/page from them.
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** The slug and whether it can be a page at all; a broken escape or a `_next/` miss cannot. */
async function slugOf(
  params: SlugPageProps['params']
): Promise<{ slug: string; unservable: ReturnType<typeof unservableSlug> }> {
  const slug = joinSlug((await params).slug);
  return { slug: slug ?? '', unservable: slug === null ? 'asset' : unservableSlug(slug) };
}

export async function generateMetadata({ params, searchParams }: SlugPageProps): Promise<Metadata> {
  const site = await resolveSite();
  if (!site) return {};
  // A dark site tells a crawler nothing; a route's metadata overrides the layout's (issue 503).
  if (site.billingPhase === 'suspended') return SUSPENDED_METADATA;
  const { slug, unservable } = await slugOf(params);
  if (unservable === 'asset') notFound();
  // Too long for any page: the page itself still tries the tenant's redirects (WW-3).
  if (unservable === 'too-long') return NOT_FOUND_METADATA;
  const sp = await searchParams;
  const previewToken = one(sp?.sparxPreview);
  const sitePreview = one(sp?.sparxSitePreview);
  const preview = sitePreview ? { previewToken: sitePreview } : {};

  const silicaPage = await getPublishedSilicaPage(site.slug, slug, preview);
  if (silicaPage) return authoredPageMetadata(silicaPage, site);
  const builderPage = await getPublishedBuilderPage(site.slug, slug, preview);
  if (builderPage) return authoredPageMetadata(builderPage, site);
  const piece = await getKindPiece(site.slug, slug, previewToken ? { previewToken } : {});
  if (piece) return kindPieceMetadata(piece, site);
  const page = await getPageBySlug(site.slug, slug, previewToken ? { previewToken } : {});
  return page ? cmsPageMetadata(page, site) : NOT_FOUND_METADATA;
}

// Tier order: silica page, builder page, content-kind piece, then CMS page + Site Builder sections.
export default async function SitePage({ params, searchParams }: SlugPageProps) {
  const site = await resolveSite();
  if (!site) notFound();
  const { slug, unservable } = await slugOf(params);
  if (unservable === 'asset') notFound();
  if (unservable === 'too-long') {
    await applyRedirect(site.slug, `/${slug}`);
    notFound();
  }
  const sp = (await searchParams) ?? {};
  const previewToken = one(sp.sparxPreview);
  // `?sparxSitePreview=` serves the DRAFT tree on both authored tiers (docs/127 §11).
  const sitePreview = one(sp.sparxSitePreview);
  const preview = sitePreview ? { previewToken: sitePreview } : {};

  const silicaPage = await getPublishedSilicaPage(site.slug, slug, preview);
  if (silicaPage) {
    return <SilicaSlugPage site={site} page={silicaPage} slug={slug} searchParams={sp} />;
  }
  const builderPage = await getPublishedBuilderPage(site.slug, slug, preview);
  if (builderPage)
    return <BuilderSlugPage site={site} page={builderPage} sitePreview={sitePreview} />;

  // After the pages above, so a page the owner made at that exact address still wins.
  const piece = await getKindPiece(site.slug, slug, previewToken ? { previewToken } : {});
  if (piece) {
    requireSiteModule(site, 'cms');
    return <KindPiecePage site={site} piece={piece} sitePreview={sitePreview} />;
  }
  return (
    <CmsSlugPage site={site} slug={slug} previewToken={previewToken} sitePreview={sitePreview} />
  );
}

// Neither a CMS page nor Site Builder sections: last chance is a tenant redirect, then 404.
async function CmsSlugPage(props: {
  site: ResolvedSite;
  slug: string;
  previewToken: string | undefined;
  sitePreview: string | undefined;
}) {
  const { site, slug, previewToken, sitePreview } = props;
  const activePropertySlug = (await resolveActivePropertySlug()) ?? undefined;
  const [page, snapshot] = await Promise.all([
    getPageBySlug(site.slug, slug, previewToken ? { previewToken } : {}),
    getPublishedSite(site.slug, sitePreview, activePropertySlug),
  ]);
  const sections = sectionsForPage(snapshot, slug);
  if (!page && sections.length === 0) {
    await applyRedirect(site.slug, `/${slug}`);
    notFound();
  }
  const { defaultCurrency, defaultLocale } = site.commerce;
  return (
    <>
      {sections.length > 0 ? (
        <SectionRenderer
          sections={sections}
          ctx={{ tenantSlug: site.slug, currency: defaultCurrency, locale: defaultLocale }}
          definitions={snapshot?.definitions ?? []}
        />
      ) : null}
      {page ? <PageView entry={page} /> : null}
    </>
  );
}
