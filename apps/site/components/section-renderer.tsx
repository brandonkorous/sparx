// Renders an ordered, visible-filtered Site Builder section list by switching
// each section's `sectionType` against a component map. Unknown types are
// skipped gracefully (a snapshot may carry a section type this storefront
// version doesn't know how to render yet). Each section is themed purely via
// the `--sf-*` tokens injected in the layout — no raw Tailwind (brand rule).
//
// Phase 3: bound sections (product/collection scope) resolve from the assigned
// item supplied on the context (docs/handoffs/sitebuilder-phase3-spec.md §6).
// Static sections ignore the binding; bound sections render nothing when their
// binding is absent.

import { customSectionType, type TemplateNode } from '@sparx/sitebuilder-schemas';

import type { PinnedDefinition, SectionSnapshot } from '@/lib/site';
import type {
  HeroConfig,
  FeaturedProductsConfig,
  CollectionGridConfig,
  RichTextConfig,
  ImageBannerConfig,
  TestimonialsConfig,
  EmailSignupConfig,
  PanelsConfig,
  MediaTextConfig,
  StatsConfig,
  CarouselConfig,
  EmbedConfig,
  ProductBuyBoxConfig,
  ProductDescriptionConfig,
  ProductFitmentConfig,
  ProductReviewsConfig,
  ProductQuestionsConfig,
  ProductRelatedConfig,
  CollectionHeaderConfig,
  CollectionProductsConfig,
} from '@sparx/sitebuilder-schemas';

import type {
  PublicProduct,
  PublicProductListItem,
  PublicQuestion,
  PublicCollection,
  PublicFitmentDomain,
} from '@/lib/commerce';

import { HeroSection } from './sections/hero';
import { FeaturedProductsSection } from './sections/featured-products';
import { CollectionGridSection } from './sections/collection-grid';
import { RichTextSection } from './sections/rich-text';
import { ImageBannerSection } from './sections/image-banner';
import { TestimonialsSection } from './sections/testimonials';
import { EmailSignupSection } from './sections/email-signup';
import { PanelsSection } from './sections/panels';
import { MediaTextSection } from './sections/media-text';
import { StatsSection } from './sections/stats';
import { CarouselSection } from './sections/carousel';
import { EmbedSection } from './sections/embed';
import { ProductBuyBoxSection } from './sections/product-buy-box';
import { ProductDescriptionSection } from './sections/product-description';
import { ProductFitmentSection } from './sections/product-fitment';
import { ProductReviewsSection } from './sections/product-reviews';
import { ProductQuestionsSection } from './sections/product-questions';
import { ProductRelatedSection } from './sections/product-related';
import { CollectionHeaderSection } from './sections/collection-header';
import { CollectionProductsSection } from './sections/collection-products';
import { CustomTemplateSection } from './sections/custom-template';

/** Everything a section needs from the tenant beyond its own config. */
export interface SectionContext {
  tenantSlug: string;
  currency: string;
  locale: string;
  // Tenant storefront display setting (PDP buy box "only N left" threshold).
  showStockBelow?: number;
  // Product binding — present only when rendering a `product`-scope template.
  product?: PublicProduct;
  productExtras?: {
    related: PublicProductListItem[];
    questions: PublicQuestion[];
    fitmentDomainsBySlug: Record<string, PublicFitmentDomain>;
  };
  // Collection binding — present only when rendering a `collection`-scope template.
  collection?: PublicCollection;
  collectionExtras?: {
    items: PublicProductListItem[];
    total: number;
    page: number;
    perPage: number;
    currentParams: Record<string, string | string[] | undefined>;
  };
}

// Published configs are validated + defaulted at publish time (the section
// service parses against the registry schema before snapshotting), so a cast
// here is safe — we never receive a partial config from the public endpoint.
function renderSection(
  section: SectionSnapshot,
  ctx: SectionContext,
  // Pinned custom-section templates by `custom:<slug>` type (docs/38 Phase C).
  customTemplates: Map<string, TemplateNode>
): React.ReactNode {
  const c = section.config;
  switch (section.sectionType) {
    case 'hero':
      return <HeroSection config={c as unknown as HeroConfig} ctx={ctx} />;
    case 'featured-products':
      return <FeaturedProductsSection config={c as unknown as FeaturedProductsConfig} ctx={ctx} />;
    case 'collection-grid':
      return <CollectionGridSection config={c as unknown as CollectionGridConfig} ctx={ctx} />;
    case 'rich-text':
      return <RichTextSection config={c as unknown as RichTextConfig} />;
    case 'image-banner':
      return <ImageBannerSection config={c as unknown as ImageBannerConfig} ctx={ctx} />;
    case 'testimonials':
      return <TestimonialsSection config={c as unknown as TestimonialsConfig} ctx={ctx} />;
    case 'email-signup':
      return <EmailSignupSection config={c as unknown as EmailSignupConfig} />;
    case 'panels':
      return <PanelsSection config={c as unknown as PanelsConfig} ctx={ctx} />;
    case 'media-text':
      return <MediaTextSection config={c as unknown as MediaTextConfig} ctx={ctx} />;
    case 'stats':
      return <StatsSection config={c as unknown as StatsConfig} ctx={ctx} />;
    case 'carousel':
      return <CarouselSection config={c as unknown as CarouselConfig} ctx={ctx} />;
    case 'embed':
      return <EmbedSection config={c as unknown as EmbedConfig} />;
    case 'product-buy-box':
      return <ProductBuyBoxSection config={c as unknown as ProductBuyBoxConfig} ctx={ctx} />;
    case 'product-description':
      return (
        <ProductDescriptionSection config={c as unknown as ProductDescriptionConfig} ctx={ctx} />
      );
    case 'product-fitment':
      return <ProductFitmentSection config={c as unknown as ProductFitmentConfig} ctx={ctx} />;
    case 'product-reviews':
      return <ProductReviewsSection config={c as unknown as ProductReviewsConfig} ctx={ctx} />;
    case 'product-questions':
      return <ProductQuestionsSection config={c as unknown as ProductQuestionsConfig} ctx={ctx} />;
    case 'product-related':
      return <ProductRelatedSection config={c as unknown as ProductRelatedConfig} ctx={ctx} />;
    case 'collection-header':
      return <CollectionHeaderSection config={c as unknown as CollectionHeaderConfig} ctx={ctx} />;
    case 'collection-products':
      return (
        <CollectionProductsSection config={c as unknown as CollectionProductsConfig} ctx={ctx} />
      );
    default: {
      // A tenant-defined custom section (`custom:<slug>`): render its pinned
      // template AST via the interpreter. Unknown / unpinned types skip rather
      // than crash the page (forward-compat with newer snapshots).
      const template = customTemplates.get(section.sectionType);
      if (template) {
        return <CustomTemplateSection template={template} config={c} ctx={ctx} />;
      }
      return null;
    }
  }
}

export function SectionRenderer({
  sections,
  ctx,
  definitions = [],
}: {
  sections: SectionSnapshot[];
  ctx: SectionContext;
  // Pinned custom-section definitions from the snapshot (docs/38 Phase C).
  definitions?: PinnedDefinition[];
}) {
  // `custom:<slug>` → its pinned template AST, resolved once for the whole list.
  const customTemplates = new Map<string, TemplateNode>(
    definitions.map((d) => [customSectionType(d.slug), d.template])
  );
  return (
    <>
      {sections.map((section) => {
        // Universal per-section height (docs/37): any static section can carry a
        // `sectionHeight` (¼/½/¾/full svh); the wrapper enforces it as a
        // min-height + vertically centres the content. `auto`/absent = unset.
        const sh = (section.config as { sectionHeight?: string } | undefined)?.sectionHeight;
        return (
          // data-section-* lets the Site Builder preview bridge resolve a click to
          // a section without each section having to become a client component.
          // data-sf-reveal opts the wrapper into the scroll-reveal entrance
          // (RevealController + site.css); inert without JS / reduced motion.
          <div
            key={section.id}
            data-section-id={section.id}
            data-section-type={section.sectionType}
            data-section-height={sh && sh !== 'auto' ? sh : undefined}
            data-sf-reveal
          >
            {renderSection(section, ctx, customTemplates)}
          </div>
        );
      })}
    </>
  );
}
