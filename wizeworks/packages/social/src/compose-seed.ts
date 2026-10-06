// "Share this" — turning a thing you already published into a draft post
// (docs/133 §8 post sources, docs/social-audit slice 8).
//
// The gap this closes: an automation could already draft "New arrival — {{title}}" from a
// product, but a PERSON clicking "New post" got a blank box. So the one moment someone is
// most likely to want to post — they just published something — was the moment the
// composer helped least, and they retyped the title and re-picked the image by hand.
//
// A seed is deliberately a DRAFT SUGGESTION, not a template: it fills the body, the link
// and the picture, and then it is ordinary text the person edits. Nothing here is
// re-derived later, so changing the product title tomorrow does not rewrite a post that
// already went out.
//
// Lives in @wizeworks/social because "how an entity becomes a post" is the post domain's
// business — 133 §8 calls each source "a small mapper into a SocialPost draft". It reads
// commerce/CMS tables directly rather than importing the automation package, which would
// drag executors into every transport that wants to seed a draft.

import { withTenant } from '@wizeworks/db';
import { resolveSiteOrigin, siteShowingRow, siteUrl } from '@wizeworks/db/site-origin';

import type { SocialContext } from './context.js';

/** What a seed can be built from. Each is something a business publishes and then wants
 *  to tell people about. */
export type ComposeSeedType = 'product' | 'collection' | 'content';

export interface ComposeSeed {
  /** Suggested opening text — edited freely from here. */
  body: string;
  /** The public URL of the thing, when it has one. */
  link: string | null;
  /** Its hero image, ready to attach. */
  mediaAssetIds: string[];
  /** Recorded on the post so its origin stays legible. */
  source: ComposeSeedType;
  sourceRef: string;
  /** The site the thing belongs to, when it is pinned to exactly one. */
  propertyId: string | null;
  /** What it is, for the composer's "Sharing: …" line. */
  title: string;
}

/** Strip markup and collapse whitespace, then cut to a length that reads as a post
 *  opening rather than an article. */
function summarize(html: string, max = 200): string {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The public base URL of the site a seeded link opens on, and that site's id.
 *
 *  The address comes from the one resolver every customer-facing link uses
 *  (`@wizeworks/db/site-origin`): the site's own domain once it works, else the
 *  subdomain it was minted on, in the zone the tenant was provisioned in. This used
 *  to be a second copy of that question with its own order and no answer for a site
 *  whose domain row was missing (sparx persona issue 064: two answers to one
 *  question). The site is one that SHOWS the thing: the one it is pinned to, else
 *  the primary for something shown everywhere, else the first site it is scoped to. */
async function siteBaseUrl(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  tenantId: string,
  linkedSiteIds: string[],
  pinned: string | null
): Promise<{ base: string; propertyId: string | null }> {
  const siteId = siteShowingRow(linkedSiteIds, pinned);
  const property = siteId
    ? await tx.property.findUnique({ where: { id: siteId }, select: { id: true } })
    : await tx.property.findFirst({ where: { isPrimary: true }, select: { id: true } });
  const base = await resolveSiteOrigin(tx, tenantId, property?.id ?? null);
  return { base, propertyId: property?.id ?? null };
}

/**
 * Build a draft post from something the business published.
 *
 * Returns null when the entity doesn't exist or isn't this tenant's — the composer then
 * opens blank, which is the honest fallback.
 */
export async function buildComposeSeed(
  ctx: SocialContext,
  type: ComposeSeedType,
  id: string
): Promise<ComposeSeed | null> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    if (type === 'product') {
      const product = await tx.product.findFirst({
        where: { id, tenantId: ctx.tenantId },
        select: {
          id: true,
          title: true,
          handle: true,
          description: true,
          ogImageId: true,
          images: {
            where: { variantId: null },
            orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
            take: 1,
            select: { mediaAssetId: true },
          },
          propertyLinks: { select: { propertyId: true } },
        },
      });
      if (!product) return null;

      // Pin the post to one site only when the product itself is scoped to exactly one;
      // a product visible everywhere shouldn't silently claim a site.
      const pinned =
        product.propertyLinks.length === 1 ? (product.propertyLinks[0]?.propertyId ?? null) : null;
      const { base, propertyId } = await siteBaseUrl(
        tx,
        ctx.tenantId,
        product.propertyLinks.map((l) => l.propertyId),
        pinned
      );
      const hero = product.ogImageId ?? product.images[0]?.mediaAssetId ?? null;
      const summary = summarize(product.description ?? '');

      return {
        title: product.title,
        body: summary ? `${product.title}\n\n${summary}` : product.title,
        link: siteUrl(base, `/products/${encodeURIComponent(product.handle)}`),
        mediaAssetIds: hero && UUID_RE.test(hero) ? [hero] : [],
        source: 'product',
        sourceRef: product.id,
        propertyId: pinned ?? propertyId,
      };
    }

    if (type === 'collection') {
      const collection = await tx.productCollection.findFirst({
        where: { id, tenantId: ctx.tenantId },
        select: {
          id: true,
          name: true,
          handle: true,
          description: true,
          heroMediaId: true,
          ogImageId: true,
          propertyLinks: { select: { propertyId: true } },
        },
      });
      if (!collection) return null;

      const pinned =
        collection.propertyLinks.length === 1
          ? (collection.propertyLinks[0]?.propertyId ?? null)
          : null;
      const { base, propertyId } = await siteBaseUrl(
        tx,
        ctx.tenantId,
        collection.propertyLinks.map((l) => l.propertyId),
        pinned
      );
      const summary = summarize(collection.description ?? '');
      const hero = collection.ogImageId ?? collection.heroMediaId ?? null;

      return {
        title: collection.name,
        body: summary ? `${collection.name}\n\n${summary}` : collection.name,
        link: siteUrl(base, `/collections/${encodeURIComponent(collection.handle)}`),
        mediaAssetIds: hero ? [hero] : [],
        source: 'collection',
        sourceRef: collection.id,
        propertyId: pinned ?? propertyId,
      };
    }

    const entry = await tx.contentEntry.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: {
        id: true,
        slug: true,
        typeKey: true,
        body: true,
        seoJson: true,
        propertyLinks: { select: { propertyId: true } },
      },
    });
    if (!entry) return null;

    // The content TYPE owns the URL shape (`/blog/:slug`) and is keyed, not related.
    const contentType = await tx.contentType.findFirst({
      where: { tenantId: ctx.tenantId, key: entry.typeKey },
      select: { urlPattern: true },
    });

    const seo = (entry.seoJson ?? {}) as Record<string, unknown>;
    const body = (entry.body ?? {}) as Record<string, unknown>;
    const title =
      firstString(seo.title, body.title, body.headline, entry.slug) ?? 'New on the site';
    const summary = summarize(
      firstString(seo.description, body.excerpt, body.summary, body.body) ?? ''
    );
    const hero = firstString(seo.ogImageId, body.heroImageId, body.imageId, body.coverImageId);

    const pinned =
      entry.propertyLinks.length === 1 ? (entry.propertyLinks[0]?.propertyId ?? null) : null;
    const { base, propertyId } = await siteBaseUrl(
      tx,
      ctx.tenantId,
      entry.propertyLinks.map((l) => l.propertyId),
      pinned
    );
    // Without a pattern fall back to `<base>/<slug>`, which is what the storefront
    // serves anyway.
    const path = contentType?.urlPattern
      ? contentType.urlPattern.replace(':slug', entry.slug ?? '')
      : `/${entry.slug ?? ''}`;

    return {
      title,
      body: summary ? `${title}\n\n${summary}` : title,
      link: entry.slug ? siteUrl(base, path) : null,
      mediaAssetIds: hero && UUID_RE.test(hero) ? [hero] : [],
      source: 'content',
      sourceRef: entry.id,
      propertyId: pinned ?? propertyId,
    };
  });
}

/** First non-empty string among the candidates, else null. */
function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}
