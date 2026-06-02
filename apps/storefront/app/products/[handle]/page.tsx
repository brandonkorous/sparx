// Product detail page (PDP). Server-loads the product, resolves the merchant's
// `product`-scope layout (or the seeded default), and renders it through the
// shared SectionRenderer bound to this product. The interactive core, fitment,
// reviews, Q&A and related rail are all bound sections (docs/30 §4). Metadata,
// JSON-LD and breadcrumbs stay as page chrome around the composed template.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { SectionRenderer } from '@/components/section-renderer';
import { BuilderRenderer } from '@/components/builder-renderer';
import { getPublishedBuilderCollection } from '@/lib/builder';
import { loadBuilderData, productToBuilderRecord } from '@/lib/builder-data';
import {
  getProduct,
  listFitmentDomains,
  listProductQuestions,
  listRelatedProducts,
  type PublicFitmentDomain,
  type PublicProductListItem,
  type PublicQuestion,
} from '@/lib/commerce';
import { mediaUrl } from '@/lib/media';
import { isSampleRequested, SAMPLE_PRODUCT, SAMPLE_PRODUCT_EXTRAS } from '@/lib/sample-data';
import { getPublishedSite, resolveTemplateSections } from '@/lib/site';
import { resolveTenant } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ handle: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const tenant = await resolveTenant();
  if (!tenant) return {};
  const { handle } = await params;
  const product = await getProduct(tenant.slug, handle);
  if (!product) return {};
  const image = mediaUrl(product.images[0]?.mediaAssetId ?? null, tenant.slug);
  return {
    title: product.seoTitle ?? product.title,
    description: product.seoDescription ?? product.description ?? undefined,
    openGraph: {
      title: product.seoTitle ?? product.title,
      description: product.seoDescription ?? product.description ?? undefined,
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}

export default async function ProductDetailPage({ params, searchParams }: PageProps) {
  const tenant = await resolveTenant();
  if (!tenant) notFound();
  const { handle } = await params;
  const sp = (await searchParams) ?? {};

  // Sample-data preview (doc 36 §9): a token-gated `sparxSampleData=1` makes the
  // page render against fixed SAMPLE_* fixtures so a merchant can design the
  // product layout before any real product exists. The layout still resolves
  // from the (draft) snapshot — only the bound data is swapped.
  const sample = isSampleRequested(sp);
  const product = sample ? SAMPLE_PRODUCT : await getProduct(tenant.slug, handle);
  if (!product) notFound();

  // The generic per-record router (docs/44 §3 B): a published Builder
  // `commerce.product` collection template renders the PDP through the node tree
  // — with the interactive Tier-2 buy-box — binding THIS product as `product`.
  // Falls through to the legacy section template when none is published, so a
  // tenant without a builder product page is unaffected. Sample-data previews
  // (the merchant designing before a product exists) keep the legacy path.
  if (!sample) {
    const builderTemplate = await getPublishedBuilderCollection(tenant.slug, 'commerce.product');
    if (builderTemplate) {
      const currency = tenant.storefront.defaultCurrency;
      const data = await loadBuilderData(tenant.slug, builderTemplate.tree, {
        key: 'product',
        value: productToBuilderRecord(product, tenant.slug, currency),
      });
      return (
        <div className="sf-container">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Products', href: '/products' },
              { label: product.title },
            ]}
          />
          <BuilderRenderer tree={builderTemplate.tree} data={data} />
        </div>
      );
    }
  }

  // The commerce:product layout: the merchant's published one, or the seeded
  // default (parity). A site-preview token resolves the draft instead. In preview
  // only, `sparxLayoutKey` forces a specific alternate layout onto the canvas
  // (gated to the preview token — a public visitor can't pin a layout via query).
  const snapshot = await getPublishedSite(tenant.slug, one(sp.sparxSitePreview));
  const forcedKey = one(sp.sparxSitePreview) ? one(sp.sparxLayoutKey) : undefined;
  const sections = resolveTemplateSections(snapshot, 'commerce:product', product.id, forcedKey);

  // Fetch only the supplementary data the resolved layout renders. The related
  // rail's count comes from its section config (default 4 — today's behavior).
  const relatedSection = sections.find((s) => s.sectionType === 'product-related');
  const relatedLimit =
    typeof relatedSection?.config.limit === 'number' ? relatedSection.config.limit : 4;
  const needsQuestions = sections.some((s) => s.sectionType === 'product-questions');
  const needsFitment =
    product.fitments.length > 0 && sections.some((s) => s.sectionType === 'product-fitment');

  let related: PublicProductListItem[];
  let questions: PublicQuestion[];
  let fitmentDomainsBySlug: Record<string, PublicFitmentDomain>;
  if (sample) {
    // Fixtures only — no fetch. Still honor which sections the layout includes.
    related = relatedSection ? SAMPLE_PRODUCT_EXTRAS.related.slice(0, relatedLimit) : [];
    questions = needsQuestions ? SAMPLE_PRODUCT_EXTRAS.questions : [];
    fitmentDomainsBySlug = needsFitment ? SAMPLE_PRODUCT_EXTRAS.fitmentDomainsBySlug : {};
  } else {
    const [r, q] = await Promise.all([
      relatedSection
        ? listRelatedProducts(tenant.slug, product, relatedLimit)
        : Promise.resolve([]),
      needsQuestions ? listProductQuestions(tenant.slug, product.handle) : Promise.resolve([]),
    ]);
    related = r;
    questions = q;
    // Fitment rows carry a domain slug + label but not the per-level labels
    // (Make/Model/Engine). Fetch the domains (cached) and map by slug so the
    // table can render vertical-appropriate column headers.
    const fitmentDomains = needsFitment
      ? await listFitmentDomains(tenant.slug).catch<PublicFitmentDomain[]>(() => [])
      : [];
    fitmentDomainsBySlug = Object.fromEntries(fitmentDomains.map((d) => [d.slug, d]));
  }

  const { defaultCurrency: currency, defaultLocale: locale, showStockBelow } = tenant.storefront;

  const primaryImage = mediaUrl(product.images[0]?.mediaAssetId ?? null, tenant.slug);
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description ?? undefined,
    ...(primaryImage ? { image: [primaryImage] } : {}),
    ...(product.vendor ? { brand: { '@type': 'Brand', name: product.vendor } } : {}),
    ...(product.reviewCount > 0 && product.averageRating != null
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.averageRating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: currency,
      lowPrice: (product.priceMinCents ?? 0) / 100,
      highPrice: (product.priceMaxCents ?? product.priceMinCents ?? 0) / 100,
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <div className="sf-container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Products', href: '/products' },
          { label: product.title },
        ]}
      />

      <SectionRenderer
        sections={sections}
        ctx={{
          tenantSlug: tenant.slug,
          currency,
          locale,
          showStockBelow,
          product,
          productExtras: { related, questions, fitmentDomainsBySlug },
        }}
        definitions={snapshot?.definitions ?? []}
      />
    </div>
  );
}
