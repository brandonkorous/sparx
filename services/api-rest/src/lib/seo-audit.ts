// SEO audit — shared signal gathering + scorecard storage (docs/50 §7).
//
// `buildAuditableEntity` normalizes one entity (under RLS) into the engine's
// input — the stored SEO columns plus content signals walked out of the published
// Builder tree / CMS doc. `auditAndStore` runs the pure engine and upserts a
// snapshot into `seo_audits` so the site-wide overview can rank pages without N
// live audits. Both the live endpoint and the reindex reuse this.

import type { Prisma, TxClient } from '@sparx/db';
import {
  auditEntity,
  extractBuilderTreeSignals,
  extractCmsDocSignals,
  extractSilicaTreeSignals,
  type AuditableEntity,
  type ContentSignals,
  type EntityType,
  type Scorecard,
} from '@sparx/seo-audit';

const rec = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const emptyToNull = (v: string | null | undefined): string | null =>
  v && v.trim().length > 0 ? v : null;
const stripHtml = (s: string): string => s.replace(/<[^>]*>/g, ' ');
const words = (s: string): number => {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
};

/**
 * Content signals from a page's SILICA tree, or null when the page has none (a legacy
 * page that predates the engine adoption — those still grade off the sparx columns).
 *
 * Published wins over draft for the same reason the legacy path prefers it: the score
 * describes what visitors can actually find. Before a first publish the draft is graded,
 * so the number is live while the page is being written rather than appearing from
 * nowhere at publish time.
 */
function silicaSignalsFor(page: {
  silicaPublishedTree: unknown;
  silicaDraftTree: unknown;
}): ContentSignals | null {
  const tree = page.silicaPublishedTree ?? page.silicaDraftTree;
  return tree == null ? null : extractSilicaTreeSignals(tree);
}

/** A best-effort storefront path for the overview link. */
export function pathFor(type: EntityType, slug: string | null): string | null {
  if (!slug) return null;
  if (type === 'product') return `/products/${slug}`;
  if (type === 'collection') return `/collections/${slug}`;
  return `/${slug}`; // builder_page, cms_page
}

/**
 * The site an audited entity belongs to, or null when it belongs to several
 * (docs/131 §4).
 *
 * Deliberately NOT a field on `AuditableEntity`: that type lives in
 * `@sparx/seo-audit`, which is a pure scoring library — it takes signals and
 * returns a grade, and knows nothing about sites or storage. Threading a
 * persistence concern through it to save one query here would couple the scorer
 * to the multi-site model for no gain.
 *
 * Only `builder_page` has a single answer. Products, collections, and CMS
 * entries reach sites through junctions and can appear on several with ONE
 * score, so null is the honest value rather than an arbitrary pick.
 */
async function siteOfAuditedEntity(
  tx: TxClient,
  type: EntityType,
  id: string
): Promise<string | null> {
  if (type !== 'builder_page') return null;
  const page = await tx.builderPage.findFirst({ where: { id }, select: { propertyId: true } });
  return page?.propertyId ?? null;
}

export async function buildAuditableEntity(
  tx: TxClient,
  type: EntityType,
  id: string
): Promise<AuditableEntity | null> {
  switch (type) {
    case 'builder_page': {
      const page = await tx.builderPage.findFirst({
        where: { id },
        select: {
          name: true,
          kind: true,
          slug: true,
          draftTree: true,
          publishedTree: true,
          silicaDraftTree: true,
          silicaPublishedTree: true,
          publishedAt: true,
          seoTitle: true,
          seoDescription: true,
          canonical: true,
          ogImage: true,
          noindex: true,
        },
      });
      if (!page) return null;
      // Audit the published tree when there is one; before first publish, the
      // draft — so the editor shows a live score while authoring.
      //
      // SILICA FIRST. A page built in the current editor stores its tree in the
      // `silica_*` columns and parks a BLANK placeholder in `draft_tree`, so reading the
      // legacy columns graded every such page against an empty document: 0 H1s (fail),
      // 0 words (warn), 0 internal links (warn), and a false "no images" pass. The
      // scorecard was not merely stale, it was measuring the wrong object — and it is
      // the only signal a non-technical owner has about whether their page can be found.
      const signals =
        silicaSignalsFor(page) ?? extractBuilderTreeSignals(page.publishedTree ?? page.draftTree);
      return {
        entityType: 'builder_page',
        title: emptyToNull(page.seoTitle) ?? page.name,
        description: emptyToNull(page.seoDescription),
        noindex: page.noindex,
        canonical: emptyToNull(page.canonical),
        slug: page.slug,
        inSitemap: page.kind === 'singleton' && !!page.slug && !!page.publishedAt && !page.noindex,
        ...signals,
        ogImage: emptyToNull(page.ogImage) ? 'custom' : 'generated',
        structuredDataTypes: [],
        inLlmsTxt: true,
      };
    }

    case 'cms_page': {
      const entry = await tx.contentEntry.findFirst({
        where: { id, deletedAt: null },
        select: { slug: true, status: true, body: true, seoJson: true },
      });
      if (!entry) return null;
      const seo = rec(entry.seoJson) ?? {};
      const body = rec(entry.body);
      const signals = extractCmsDocSignals(entry.body);
      return {
        entityType: 'cms_page',
        title: emptyToNull(str(seo.title)) ?? emptyToNull(str(body?.title)),
        description: emptyToNull(str(seo.description)),
        noindex: /noindex/i.test(str(seo.robots)),
        canonical: emptyToNull(str(seo.canonical)),
        slug: entry.slug,
        inSitemap: entry.status === 'published' && !!entry.slug,
        ...signals,
        ogImage: emptyToNull(str(seo.ogImage)) ? 'custom' : 'generated',
        structuredDataTypes: [],
        inLlmsTxt: true,
      };
    }

    case 'product': {
      const product = await tx.product.findFirst({
        where: { id, deletedAt: null },
        select: {
          title: true,
          handle: true,
          status: true,
          description: true,
          seoTitle: true,
          seoDescription: true,
          ogImageId: true,
          images: { where: { variantId: null }, select: { alt: true } },
        },
      });
      if (!product) return null;
      const imageCount = product.images.length;
      const imagesMissingAlt = product.images.filter((im) => words(str(im.alt)) === 0).length;
      const descText = stripHtml(product.description ?? '');
      return {
        entityType: 'product',
        title: emptyToNull(product.seoTitle) ?? product.title,
        description: emptyToNull(product.seoDescription) ?? emptyToNull(descText),
        noindex: false,
        canonical: null,
        slug: product.handle,
        inSitemap: product.status === 'active',
        h1Count: 1,
        wordCount: words(descText),
        imageCount,
        imagesMissingAlt,
        internalLinkCount: 1,
        ogImage: product.ogImageId || imageCount > 0 ? 'custom' : 'generated',
        structuredDataTypes: ['Product'],
        inLlmsTxt: true,
      };
    }

    case 'collection': {
      const collection = await tx.productCollection.findFirst({
        where: { id, deletedAt: null },
        select: {
          name: true,
          handle: true,
          description: true,
          seoTitle: true,
          seoDescription: true,
          ogImageId: true,
          heroMediaId: true,
        },
      });
      if (!collection) return null;
      const descText = stripHtml(collection.description ?? '');
      return {
        entityType: 'collection',
        title: emptyToNull(collection.seoTitle) ?? collection.name,
        description: emptyToNull(collection.seoDescription) ?? emptyToNull(descText),
        noindex: false,
        canonical: null,
        slug: collection.handle,
        inSitemap: true,
        h1Count: 1,
        wordCount: words(descText),
        imageCount: 0,
        imagesMissingAlt: 0,
        internalLinkCount: 1,
        ogImage: collection.ogImageId || collection.heroMediaId ? 'custom' : 'generated',
        structuredDataTypes: [],
        inLlmsTxt: true,
      };
    }
  }
}

/** Build → score → stamp → upsert the snapshot. Returns the card, or null when
 *  the entity doesn't exist in this tenant. */
export async function auditAndStore(
  tx: TxClient,
  tenantId: string,
  type: EntityType,
  id: string
): Promise<Scorecard | null> {
  const entity = await buildAuditableEntity(tx, type, id);
  if (!entity) return null;

  const card = auditEntity(entity);
  const now = new Date();
  card.computedAt = now.toISOString();

  const title = entity.title?.slice(0, 300) ?? null;
  const path = pathFor(type, entity.slug);
  const fixFirst = card.fixFirst?.slice(0, 500) ?? null;
  const cardJson = card as unknown as Prisma.InputJsonValue;

  await tx.seoAudit.upsert({
    where: { tenantId_entityType_entityId: { tenantId, entityType: type, entityId: id } },
    create: {
      tenantId,
      // Only builder pages belong to exactly one site (docs/131 §4). Products,
      // collections, and CMS entries reach sites through junctions and may show
      // on several with one score, so they stay null rather than being pinned to
      // a site the data does not actually claim.
      propertyId: await siteOfAuditedEntity(tx, type, id),
      entityType: type,
      entityId: id,
      score: card.score,
      grade: card.grade,
      fixFirst,
      title,
      path,
      card: cardJson,
      computedAt: now,
    },
    update: {
      score: card.score,
      grade: card.grade,
      fixFirst,
      title,
      path,
      card: cardJson,
      computedAt: now,
    },
  });

  return card;
}
