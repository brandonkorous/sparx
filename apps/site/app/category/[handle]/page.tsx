// Category DETAIL — an EDITABLE shell around a PINNED `commerce.category-detail` core
// (docs/122). A category is a browse tree node: its header, subcategories, and paginated
// product ROLLUP (self + descendants) are server-computed, so the whole experience lives in
// the host node the tenant can restyle and surround but not delete. The route renders the
// tenant's published `commerce.category` template (or the code fallback). This is a
// per-record template: the record is the category, keyed by id for the lookup; the core
// resolves the rest from the handle + page (searchParams). Metadata + the 404/redirect guard
// stay on the route; breadcrumbs render inside the core (they need the lineage it computes).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublishedSilicaCollection } from '@/lib/silica';
import { categoryDetailPage } from '@sparx/silica-catalog';

import { SilicaFunctionalBody } from '@/components/silica-chrome';
import { storefrontHostRenderer } from '@/components/silica-host-cores';
import { getCategory } from '@/lib/commerce';
import { mediaUrl } from '@/lib/media';
import { ogImageUrl } from '@/lib/og';
import { applyRedirect } from '@/lib/redirects';
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ handle: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const site = await resolveSite();
  if (!site) return {};
  const { handle } = await params;
  const category = await getCategory(site.slug, handle);
  if (!category) return {};
  // Author-set OG, then the category hero, then a tenant-branded generated card
  // — so a category always has a real social image.
  const image =
    mediaUrl(category.ogImageId ?? category.heroMediaId ?? null, site.slug) ??
    ogImageUrl({
      title: category.seoTitle ?? category.name,
      eyebrow: 'Category',
      brand: site.name,
      accent: site.theme?.colorPrimary,
    });
  return {
    title: category.seoTitle ?? category.name,
    description: category.seoDescription ?? category.description ?? undefined,
    openGraph: {
      title: category.seoTitle ?? category.name,
      description: category.seoDescription ?? category.description ?? undefined,
      images: [{ url: image }],
    },
  };
}

export default async function CategoryDetailPage({ params, searchParams }: PageProps) {
  const site = await resolveSite();
  if (!site) notFound();
  const { handle } = await params;
  const sp = (await searchParams) ?? {};

  const category = await getCategory(site.slug, handle);
  if (!category) {
    await applyRedirect(site.slug, `/category/${handle}`);
    notFound();
  }

  const propertySlug = await resolveActivePropertySlug();
  // The tenant's published category template (per-record override → type default → code
  // fallback). The core renders the header + subcategories + product rollup from the handle.
  const published = await getPublishedSilicaCollection(site.slug, 'commerce.category', category.id);
  const shell = published?.root ?? categoryDetailPage();
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
