// Storefront home. Renders (when present) the tenant's CMS `home` page on
// top, then a composed commerce homepage: hero, featured collections, and a
// fresh-products rail. A brand-new store with no content still gets a polished
// landing page rather than an empty shell.

import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SparxButton } from '@sparx/site-ui';

import { PageView } from '@/components/page-view';
import { ProductCard } from '@/components/product-card';
import { SectionRenderer } from '@/components/section-renderer';
import { BuilderRenderer } from '@/components/builder-renderer';
import { listCollections, listProducts } from '@/lib/commerce';
import { getPageBySlug } from '@/lib/content';
import { getPublishedBuilderHome, getPublishedBuilderStyles } from '@/lib/builder';
import { loadBuilderData } from '@/lib/builder-data';
import { mediaUrl } from '@/lib/media';
import { getPublishedSite, sectionsForPage } from '@/lib/site';
import { resolveActivePropertySlug, resolveSite } from '@/lib/site-context';

export const dynamic = 'force-dynamic';

interface RootPageProps {
  searchParams?: Promise<{ sparxPreview?: string; sparxSitePreview?: string }>;
}

export default async function SiteRoot({ searchParams }: RootPageProps) {
  const site = await resolveSite();
  if (!site) notFound();

  const sp = (await searchParams) ?? {};

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
        <section className="st-container">
          <div className="st-hero">
            <span className="st-eyebrow">Welcome to {site.name}</span>
            <h1 className="st-hero__title">Gear built to perform, priced to move.</h1>
            <p className="st-hero__sub">
              Browse the full catalog, find exactly what fits, and check out in seconds.
            </p>
            <div className="st-hero__cta">
              <SparxButton asChild color="primary" size="lg">
                <Link href="/products">Shop all products</Link>
              </SparxButton>
              <SparxButton asChild color="neutral" variant="outline" size="lg">
                <Link href="/collections">Browse collections</Link>
              </SparxButton>
            </div>
          </div>
        </section>
      ) : null}

      {collectionShelf.length > 0 ? (
        <section className="st-container st-section">
          <div className="st-section__head">
            <h2 className="st-h2">Shop by collection</h2>
            <Link href="/collections" className="st-section__link">
              View all →
            </Link>
          </div>
          <div className="st-grid">
            {collectionShelf.map((c) => {
              const hero = mediaUrl(c.heroMediaId, site.slug);
              return (
                <Link key={c.id} href={`/collections/${c.handle}`} className="st-card">
                  <div className="st-card__media">
                    {hero ? (
                      <Image
                        src={hero}
                        alt={c.name}
                        fill
                        sizes="(max-width: 860px) 100vw, 33vw"
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
        </section>
      ) : null}

      {fresh.items.length > 0 ? (
        <section className="st-container st-section">
          <div className="st-section__head">
            <h2 className="st-h2">New arrivals</h2>
            <Link href="/products?sort=newest" className="st-section__link">
              Shop all →
            </Link>
          </div>
          <div className="st-grid">
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
