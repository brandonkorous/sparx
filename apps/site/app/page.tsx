// Storefront home. Renders (when present) the tenant's CMS `home` page on
// top, then a composed commerce homepage: hero, featured collections, and a
// fresh-products rail. A brand-new store with no content still gets a polished
// landing page rather than an empty shell.

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageView } from '@/components/page-view';
import { ProductCard } from '@/components/product-card';
import { SectionRenderer } from '@/components/section-renderer';
import { BuilderRenderer } from '@/components/builder-renderer';
import { listCollections, listProducts } from '@/lib/commerce';
import { getPageBySlug } from '@/lib/content';
import { getPublishedBuilderHome, getPublishedBuilderStyles } from '@/lib/builder';
import { getPublishedSilicaHome } from '@/lib/silica';
import { buildSilicaHost } from '@/lib/silica-data';
import { SilicaBody } from '@/components/silica-chrome';
import { loadBuilderData } from '@/lib/builder-data';
import { mediaUrl } from '@/lib/media';
import { ogImageUrl } from '@/lib/og';
import { getPublishedSite, sectionsForPage } from '@/lib/site';
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';
import { ButtonLink } from '@/components/button-link';

export const dynamic = 'force-dynamic';

interface RootPageProps {
  searchParams?: Promise<{ sparxPreview?: string; sparxSitePreview?: string }>;
}

// The silica engine's published HOME page owns `/` (docs/118 Stage 6) — title it
// from its own SEO fields, mirroring the [...slug] route's silica branch. Every
// other home path (legacy Builder, Site Builder, empty-store) keeps the generic
// layout-level fallback, unchanged.
export async function generateMetadata({ searchParams }: RootPageProps): Promise<Metadata> {
  const site = await resolveSite();
  if (!site) return {};
  // Same preview token as the body below: an author previewing an unpublished home
  // should see its unpublished title/description too, not the live page's.
  const sitePreview = (await searchParams)?.sparxSitePreview;
  const silicaHome = await getPublishedSilicaHome(
    site.slug,
    sitePreview ? { previewToken: sitePreview } : {}
  );
  if (!silicaHome) return {};

  const clean = (v: string | null): string | undefined => {
    const t = v?.trim();
    return t && t.length > 0 ? t : undefined;
  };
  const title = clean(silicaHome.seoTitle) ?? site.name;
  const description = clean(silicaHome.seoDescription);
  const canonical = clean(silicaHome.canonical);
  const ogImage =
    clean(silicaHome.ogImage) ??
    ogImageUrl({
      title: clean(silicaHome.seoTitle) ?? site.name,
      eyebrow: 'Home',
      brand: site.name,
      accent: site.theme?.colorPrimary,
    });
  return {
    title,
    ...(description ? { description } : {}),
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: { title, ...(description ? { description } : {}), images: [{ url: ogImage }] },
    robots: silicaHome.noindex ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default async function SiteRoot({ searchParams }: RootPageProps) {
  const site = await resolveSite();
  if (!site) notFound();

  const sp = (await searchParams) ?? {};

  // The silica engine's published HOME body (docs/118 Stage 6) owns `/` and wins
  // over every path below — the same additive rule, one layer up. Rendered end to
  // end through `renderSilicaBody` (SilicaBody), bindings resolved against the sparx
  // host built over its data needs. Null until a silica home is published.
  //
  // A `?sparxSitePreview=` token serves the DRAFT home. This read used to ignore the
  // token entirely — `sp.sparxSitePreview` was only consulted further down, on the
  // legacy paths — and because the silica branch ALWAYS resolves (the code starter is
  // the universal fallback), Preview could never show unpublished work on `/`, the page
  // authors edit most. A tenant who had never published saw the starter instead.
  const silicaHome = await getPublishedSilicaHome(
    site.slug,
    sp.sparxSitePreview ? { previewToken: sp.sparxSitePreview } : {}
  );
  if (silicaHome) {
    const host = await buildSilicaHost(site.slug, silicaHome.root, {
      currency: site.commerce.defaultCurrency,
      locale: site.commerce.defaultLocale,
    });
    return <SilicaBody root={silicaHome.root} symbols={silicaHome.symbols} host={host} />;
  }

  // A published Builder HOME page (the slugless singleton) owns `/` and wins over
  // every legacy path — the same additive "Builder owns it, else fall through"
  // rule as the [...slug] route (docs/44 §2.5). Per-property (docs/49): each site
  // resolves its OWN home, so a secondary site renders its home here instead of
  // inheriting the tenant-wide snapshot. A site-preview token swaps in the DRAFT.
  const sitePreview = sp.sparxSitePreview;
  const builderHome = await getPublishedBuilderHome(
    site.slug,
    sitePreview ? { previewToken: sitePreview } : {}
  );
  if (builderHome) {
    const data = await loadBuilderData(
      site.slug,
      builderHome.tree,
      undefined,
      site.commerce.defaultCurrency
    );
    const draftCss = sitePreview
      ? await getPublishedBuilderStyles(site.slug, { previewToken: sitePreview })
      : '';
    return (
      <>
        {draftCss ? (
          <style data-surface-preview dangerouslySetInnerHTML={{ __html: draftCss }} />
        ) : null}
        <BuilderRenderer tree={builderHome.tree} data={data} />
      </>
    );
  }

  // Site Builder home composition wins when the tenant has published one — or,
  // with a site-preview token, the current unsaved draft.
  const snapshot = await getPublishedSite(
    site.slug,
    sp.sparxSitePreview,
    (await resolveActivePropertySlug()) ?? undefined
  );
  const homeSections = sectionsForPage(snapshot, 'home');
  if (homeSections.length > 0) {
    const { defaultCurrency, defaultLocale } = site.commerce;
    return (
      <SectionRenderer
        sections={homeSections}
        ctx={{ tenantSlug: site.slug, currency: defaultCurrency, locale: defaultLocale }}
        definitions={snapshot?.definitions ?? []}
      />
    );
  }

  // Empty-store fallback: the composed commerce homepage.
  const previewToken = sp.sparxPreview;
  const [cmsHome, collections, fresh] = await Promise.all([
    getPageBySlug(site.slug, 'home', previewToken ? { previewToken } : {}).catch(() => null),
    listCollections(site.slug).catch(() => []),
    listProducts(site.slug, { sort: 'newest', perPage: 8 }).catch(() => ({ items: [] })),
  ]);

  const featuredCollections = collections.filter((c) => c.featured).slice(0, 3);
  const collectionShelf =
    featuredCollections.length > 0 ? featuredCollections : collections.slice(0, 3);
  const { defaultCurrency: currency, defaultLocale: locale } = site.commerce;

  return (
    <>
      {cmsHome ? <PageView entry={cmsHome} /> : null}

      {!cmsHome ? (
        <section className="mx-auto w-full max-w-6xl px-6">
          <div className="flex flex-col items-center gap-6 py-[clamp(3.5rem,8vw,7rem)] text-center">
            <h1 className="text-base-content max-w-[16ch] text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.04] font-bold tracking-tight">
              Gear built to perform, priced to move.
            </h1>
            <p className="text-base-content max-w-[52ch] text-[clamp(1.05rem,2vw,1.3rem)] leading-relaxed">
              Browse the full catalog, find exactly what fits, and check out in seconds.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/products" color="primary" size="lg">
                Shop all products
              </ButtonLink>
              <ButtonLink href="/collections" color="neutral" variant="outline" size="lg">
                Browse collections
              </ButtonLink>
            </div>
          </div>
        </section>
      ) : null}

      {collectionShelf.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="mb-7 flex items-end justify-between gap-4">
            <h2 className="text-base-content text-3xl font-semibold tracking-tight">
              Shop by collection
            </h2>
            <Link
              href="/collections"
              className="text-primary text-sm font-medium whitespace-nowrap hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[clamp(1rem,2vw,1.75rem)]">
            {collectionShelf.map((c) => {
              const hero = mediaUrl(c.heroMediaId, site.slug);
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
                        sizes="(max-width: 860px) 100vw, 33vw"
                        className="object-cover transition-transform duration-[400ms] group-hover:scale-105"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        className="bg-base-200 text-base-content/40 grid h-full place-items-center text-4xl"
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
        </section>
      ) : null}

      {fresh.items.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="mb-7 flex items-end justify-between gap-4">
            <h2 className="text-base-content text-3xl font-semibold tracking-tight">
              New arrivals
            </h2>
            <Link
              href="/products?sort=newest"
              className="text-primary text-sm font-medium whitespace-nowrap hover:underline"
            >
              Shop all →
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[clamp(1rem,2vw,1.75rem)]">
            {fresh.items.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                tenantSlug={site.slug}
                currency={currency}
                locale={locale}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
