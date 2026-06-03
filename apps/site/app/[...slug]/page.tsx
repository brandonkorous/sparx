// Catch-all page route. Joins the URL path segments with `/` and looks up
// a `page`-typed CMS entry with that slug under the tenant resolved from
// the Host header. Honors `?sparxPreview=<token>` for draft access.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { resolveTenant } from '@/lib/tenant';
import { getPageBySlug } from '@/lib/content';
import { ogImageUrl } from '@/lib/og';
import { applyRedirect } from '@/lib/redirects';
import { getPublishedSite, sectionsForPage } from '@/lib/site';
import { getPublishedBuilderPage, getPublishedBuilderStyles } from '@/lib/builder';
import { loadBuilderData } from '@/lib/builder-data';
import { PageView } from '@/components/page-view';
import { SectionRenderer } from '@/components/section-renderer';
import { BuilderRenderer } from '@/components/builder-renderer';

export const dynamic = 'force-dynamic';

interface SlugPageProps {
  params: Promise<{ slug: string[] }>;
  searchParams?: Promise<{ sparxPreview?: string; sparxSitePreview?: string }>;
}

function buildSlug(parts: string[]): string {
  return parts.map((p) => decodeURIComponent(p)).join('/');
}

export async function generateMetadata({ params, searchParams }: SlugPageProps): Promise<Metadata> {
  const tenant = await resolveTenant();
  if (!tenant) return {};
  const slug = buildSlug((await params).slug);
  const sp = await searchParams;
  const previewToken = sp?.sparxPreview;
  const sitePreview = sp?.sparxSitePreview;

  // A Builder page owns its slug — title it from the page name (docs/44). Under a
  // site-preview token, the DRAFT page's name.
  const builderPage = await getPublishedBuilderPage(
    tenant.slug,
    slug,
    sitePreview ? { previewToken: sitePreview } : {}
  );
  if (builderPage) {
    // Author-set SEO (docs/50) wins; blank/whitespace fields fall back to the
    // page name. `clean` collapses empty strings to undefined so the `??`
    // fallbacks below fire (which `seoTitle ?? …` alone wouldn't).
    const clean = (v: string | null): string | undefined => {
      const t = v?.trim();
      return t && t.length > 0 ? t : undefined;
    };
    const title = clean(builderPage.seoTitle) ?? `${builderPage.name} · ${tenant.name}`;
    const description = clean(builderPage.seoDescription);
    const canonical = clean(builderPage.canonical);
    // Author-set OG URL wins; otherwise a tenant-branded generated card
    // (docs/50 §5) so every Builder page has a real social image.
    const ogImage =
      clean(builderPage.ogImage) ??
      ogImageUrl({
        title: clean(builderPage.seoTitle) ?? builderPage.name,
        eyebrow: 'Page',
        brand: tenant.name,
        accent: tenant.theme?.colorPrimary,
      });
    return {
      title,
      ...(description ? { description } : {}),
      ...(canonical ? { alternates: { canonical } } : {}),
      openGraph: {
        title,
        ...(description ? { description } : {}),
        images: [{ url: ogImage }],
      },
      robots: builderPage.noindex ? { index: false, follow: false } : { index: true, follow: true },
    };
  }

  const page = await getPageBySlug(tenant.slug, slug, previewToken ? { previewToken } : {});
  if (!page) return {};

  const seo = page.seo ?? {};
  const seoTitle = typeof seo.title === 'string' ? seo.title : undefined;
  const seoDescription = typeof seo.description === 'string' ? seo.description : undefined;
  const bodyTitle = typeof page.body.title === 'string' ? page.body.title : undefined;
  const title = seoTitle ?? bodyTitle ?? tenant.name;

  return {
    title,
    ...(seoDescription ? { description: seoDescription } : {}),
    // CMS pages carry no image of their own — give them a tenant-branded
    // generated social card (docs/50 §5).
    openGraph: {
      title,
      ...(seoDescription ? { description: seoDescription } : {}),
      images: [
        {
          url: ogImageUrl({
            title,
            eyebrow: 'Page',
            brand: tenant.name,
            accent: tenant.theme?.colorPrimary,
          }),
        },
      ],
    },
    robots: page.status === 'published' ? { index: true, follow: true } : { index: false },
  };
}

export default async function StorefrontPage({ params, searchParams }: SlugPageProps) {
  const tenant = await resolveTenant();
  if (!tenant) notFound();

  const slug = buildSlug((await params).slug);
  const sp = (await searchParams) ?? {};
  const previewToken = sp.sparxPreview;

  // A published Builder page owns its slug (docs/44 §2.5): if one exists, render
  // it and skip the legacy Site-Builder-sections + CMS-page paths entirely. Its
  // bindings resolve against real records fetched per source (docs/44 §3 A.2). A
  // valid `?sparxSitePreview=<token>` swaps in the DRAFT page (docs/45 §2.6).
  const sitePreview = sp.sparxSitePreview;
  const builderPage = await getPublishedBuilderPage(
    tenant.slug,
    slug,
    sitePreview ? { previewToken: sitePreview } : {}
  );
  if (builderPage) {
    const data = await loadBuilderData(tenant.slug, builderPage.tree);
    // In preview, inject the DRAFT Surface sheet so classes authored since the
    // last publish resolve (the layout injects only the published sheet). A plain
    // inline <style> in the body lands after it, simply adding the missing rules.
    const draftCss = sitePreview
      ? await getPublishedBuilderStyles(tenant.slug, { previewToken: sitePreview })
      : '';
    return (
      <>
        {draftCss ? (
          <style data-surface-preview dangerouslySetInnerHTML={{ __html: draftCss }} />
        ) : null}
        <BuilderRenderer tree={builderPage.tree} data={data} />
      </>
    );
  }

  const [page, snapshot] = await Promise.all([
    getPageBySlug(tenant.slug, slug, previewToken ? { previewToken } : {}),
    getPublishedSite(tenant.slug, sp.sparxSitePreview),
  ]);
  const sections = sectionsForPage(snapshot, slug);

  // Neither a CMS page nor Site Builder sections exist for this slug — last
  // chance is a tenant-managed redirect before we 404.
  if (!page && sections.length === 0) {
    await applyRedirect(tenant.slug, `/${slug}`);
    notFound();
  }

  const { defaultCurrency, defaultLocale } = tenant.storefront;
  return (
    <>
      {sections.length > 0 ? (
        <SectionRenderer
          sections={sections}
          ctx={{ tenantSlug: tenant.slug, currency: defaultCurrency, locale: defaultLocale }}
          definitions={snapshot?.definitions ?? []}
        />
      ) : null}
      {page ? <PageView entry={page} /> : null}
    </>
  );
}
