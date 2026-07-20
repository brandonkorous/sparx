// Catch-all page route. Joins the URL path segments with `/` and looks up
// a `page`-typed CMS entry with that slug under the tenant resolved from
// the Host header. Honors `?sparxPreview=<token>` for draft access.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';
import { getPageBySlug } from '@/lib/content';
import { ogImageUrl } from '@/lib/og';
import { applyRedirect } from '@/lib/redirects';
import { getPublishedSite, sectionsForPage } from '@/lib/site';
import { getPublishedBuilderPage, getPublishedBuilderStyles } from '@/lib/builder';
import { getPublishedSilicaPage } from '@/lib/silica';
import { buildSilicaHost } from '@/lib/silica-data';
import { loadBuilderData } from '@/lib/builder-data';
import { PageView } from '@/components/page-view';
import { SectionRenderer } from '@/components/section-renderer';
import { BuilderRenderer } from '@/components/builder-renderer';
import { SilicaBody } from '@/components/silica-chrome';

export const dynamic = 'force-dynamic';

interface SlugPageProps {
  params: Promise<{ slug: string[] }>;
  searchParams?: Promise<{ sparxPreview?: string; sparxSitePreview?: string }>;
}

function buildSlug(parts: string[]): string {
  return parts.map((p) => decodeURIComponent(p)).join('/');
}

export async function generateMetadata({ params, searchParams }: SlugPageProps): Promise<Metadata> {
  const site = await resolveSite();
  if (!site) return {};
  const slug = buildSlug((await params).slug);
  const sp = await searchParams;
  const previewToken = sp?.sparxPreview;
  const sitePreview = sp?.sparxSitePreview;

  // The silica engine's published page owns this slug (docs/118 Stage 6) — title it
  // from its name / SEO, and skip the paths below. Per-page silica SEO lands with
  // the inspector (docs/118 Stage 10); until then it falls back to the page name.
  // Honours the site-preview token so preview metadata matches preview content.
  const silicaPage = await getPublishedSilicaPage(
    site.slug,
    slug,
    sitePreview ? { previewToken: sitePreview } : {}
  );
  if (silicaPage) {
    const clean = (v: string | null): string | undefined => {
      const t = v?.trim();
      return t && t.length > 0 ? t : undefined;
    };
    const title = clean(silicaPage.seoTitle) ?? `${silicaPage.name} · ${site.name}`;
    const description = clean(silicaPage.seoDescription);
    const canonical = clean(silicaPage.canonical);
    const ogImage =
      clean(silicaPage.ogImage) ??
      ogImageUrl({
        title: clean(silicaPage.seoTitle) ?? silicaPage.name,
        eyebrow: 'Page',
        brand: site.name,
        accent: site.theme?.colorPrimary,
      });
    return {
      title,
      ...(description ? { description } : {}),
      ...(canonical ? { alternates: { canonical } } : {}),
      openGraph: { title, ...(description ? { description } : {}), images: [{ url: ogImage }] },
      robots: silicaPage.noindex ? { index: false, follow: false } : { index: true, follow: true },
    };
  }

  // A Builder page owns its slug — title it from the page name (docs/44). Under a
  // site-preview token, the DRAFT page's name.
  const builderPage = await getPublishedBuilderPage(
    site.slug,
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
    const title = clean(builderPage.seoTitle) ?? `${builderPage.name} · ${site.name}`;
    const description = clean(builderPage.seoDescription);
    const canonical = clean(builderPage.canonical);
    // Author-set OG URL wins; otherwise a tenant-branded generated card
    // (docs/50 §5) so every Builder page has a real social image.
    const ogImage =
      clean(builderPage.ogImage) ??
      ogImageUrl({
        title: clean(builderPage.seoTitle) ?? builderPage.name,
        eyebrow: 'Page',
        brand: site.name,
        accent: site.theme?.colorPrimary,
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

  const page = await getPageBySlug(site.slug, slug, previewToken ? { previewToken } : {});
  if (!page) return {};

  const seo = page.seo ?? {};
  const seoTitle = typeof seo.title === 'string' ? seo.title : undefined;
  const seoDescription = typeof seo.description === 'string' ? seo.description : undefined;
  const bodyTitle = typeof page.body.title === 'string' ? page.body.title : undefined;
  const title = seoTitle ?? bodyTitle ?? site.name;

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
            brand: site.name,
            accent: site.theme?.colorPrimary,
          }),
        },
      ],
    },
    robots: page.status === 'published' ? { index: true, follow: true } : { index: false },
  };
}

export default async function SitePage({ params, searchParams }: SlugPageProps) {
  const site = await resolveSite();
  if (!site) notFound();

  const slug = buildSlug((await params).slug);
  const sp = (await searchParams) ?? {};
  const previewToken = sp.sparxPreview;

  // The silica engine's published page owns this slug (docs/118 Stage 6) and wins
  // over every path below. Rendered end to end through `renderSilicaBody`, its
  // bindings resolved against the sparx host built over its data needs. Null when
  // no silica page owns the slug — the storefront falls through to the sparx builder
  // page / CMS / sections paths unchanged.
  // A valid `?sparxSitePreview=` serves the DRAFT tree here too (docs/127 §11). The
  // silica tier previously took no token at all, so an author previewing a page the
  // silica engine owns — which is every page today — saw PUBLISHED output, while the
  // sparx-tier fallback below honoured drafts. Same feature, different behaviour
  // depending on which tier happened to own the page.
  const sitePreview = sp.sparxSitePreview;
  const silicaPage = await getPublishedSilicaPage(
    site.slug,
    slug,
    sitePreview ? { previewToken: sitePreview } : {}
  );
  if (silicaPage) {
    const host = await buildSilicaHost(site.slug, silicaPage.root, {
      currency: site.commerce.defaultCurrency,
      locale: site.commerce.defaultLocale,
    });
    return <SilicaBody root={silicaPage.root} symbols={silicaPage.symbols} host={host} />;
  }

  // A published Builder page owns its slug (docs/44 §2.5): if one exists, render
  // it and skip the legacy Site-Builder-sections + CMS-page paths entirely. Its
  // bindings resolve against real records fetched per source (docs/44 §3 A.2). A
  // valid `?sparxSitePreview=<token>` swaps in the DRAFT page (docs/45 §2.6).
  const builderPage = await getPublishedBuilderPage(
    site.slug,
    slug,
    sitePreview ? { previewToken: sitePreview } : {}
  );
  if (builderPage) {
    const data = await loadBuilderData(site.slug, builderPage.tree);
    // In preview, inject the DRAFT Surface sheet so classes authored since the
    // last publish resolve (the layout injects only the published sheet). A plain
    // inline <style> in the body lands after it, simply adding the missing rules.
    const draftCss = sitePreview
      ? await getPublishedBuilderStyles(site.slug, { previewToken: sitePreview })
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

  const activePropertySlug = (await resolveActivePropertySlug()) ?? undefined;
  const [page, snapshot] = await Promise.all([
    getPageBySlug(site.slug, slug, previewToken ? { previewToken } : {}),
    getPublishedSite(site.slug, sp.sparxSitePreview, activePropertySlug),
  ]);
  const sections = sectionsForPage(snapshot, slug);

  // Neither a CMS page nor Site Builder sections exist for this slug — last
  // chance is a tenant-managed redirect before we 404.
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
