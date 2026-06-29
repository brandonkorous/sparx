// CMS content slice — long-form articles (blog posts). CMS-gated.
//
// `body` is written raw (no validateAndNormalizeBody — that lives in @sparx/api-core,
// which @sparx/db can't import; the legal-page backfill writes raw the same way).
// It conforms to the built-in `blog_post` schema: { title, excerpt, body } where
// body is a TipTap doc (see ./prose.ts). Slugs carry the `sample-` prefix so Clear
// finds them; entries are scoped to the primary site via ContentEntryProperty so
// they don't bleed across a tenant's other sites.

import { SAMPLE_SLUG_PREFIX } from '../markers';
import type { Prisma } from '@prisma/client';

import type { SampleDataPack } from '../types';
import { type ApplyCtx, daysAgo } from './context';
import { articleImageKey, createSampleImageAsset } from './media';

function sampleSlug(slug: string): string {
  return slug.startsWith(SAMPLE_SLUG_PREFIX) ? slug : `${SAMPLE_SLUG_PREFIX}${slug}`;
}

export async function applyContent(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  if (!ctx.isOn('cms')) return;
  const { tx, tenantId } = ctx;

  for (const article of pack.articles ?? []) {
    const status = article.status ?? 'published';
    // Cover image: a sample MediaAsset whose id goes in `body.featuredImage` (an
    // asset-id string the storefront resolves via /v1/public/media/:id).
    const featuredImage = await createSampleImageAsset(ctx, {
      slug: article.slug,
      key: articleImageKey(article, pack.industry),
      alt: article.title,
      width: 1200,
      height: 630,
    });
    const body = {
      title: article.title,
      excerpt: article.excerpt,
      body: article.body,
      featuredImage,
    };
    const seo = { title: article.title, description: article.excerpt };
    const publishedAt = status === 'published' ? daysAgo(ctx, article.daysAgo ?? 7) : null;
    const entry = await tx.contentEntry.create({
      data: {
        tenantId,
        typeKey: article.typeKey ?? 'blog_post',
        slug: sampleSlug(article.slug),
        status,
        body: body as Prisma.InputJsonObject,
        seoJson: seo,
        publishedAt,
        createdAt: publishedAt ?? new Date(ctx.now),
      },
      select: { id: true },
    });
    ctx.counts.articles += 1;
    if (ctx.propertyId) {
      await tx.contentEntryProperty.create({
        data: { entryId: entry.id, propertyId: ctx.propertyId },
      });
    }
  }
}
