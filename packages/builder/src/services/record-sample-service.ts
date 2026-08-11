// recordSampleService — one REAL record per record address, so Preview opens a page
// instead of a pattern.
//
// A record detail page lives at an address, not a URL: `/products/:handle` is where the
// page is, but a browser sent there gets a 404, because `:handle` is a literal segment as
// far as the router is concerned. Preview therefore had to fall back to the route's INDEX
// (`/products`) — honest, and still the wrong screen. An author laying out a product
// DETAIL page pressed Preview and got the product LIST: none of the work they had just
// done was on it. The template needs a record to point at, so this finds one.
//
// WHY A SAMPLE ROW AND NOT PLACEHOLDER DATA. The canvas already invents believable
// placeholder records (`preview-data.ts` in the workbench) — that is what makes bindings
// resolve while editing. Preview is the opposite promise: it opens the LIVE site, which
// only renders rows that actually exist. So this reads the real catalog, under the real
// visibility rules, and returns nothing at all rather than a handle the storefront would
// 404 on.
//
// THE FILTERS MIRROR THE STOREFRONT'S, DELIBERATELY. Each query repeats the public read's
// own predicate — active/published, not soft-deleted, and `@sparx/db`'s Model B site
// scoping (docs/49 §3). Preview must land on a page the visitor could actually reach: a
// draft product or another site's exclusive collection would render for the author and
// 404 for everyone else, which is a worse lie than the index page was.
//
// Every read is `take: 1` ordered by `updatedAt desc` — the record the author touched most
// recently is the one they are most likely designing against, and it keeps the whole set
// to five single-row lookups.

import { RECORD_ADDRESSES, type RecordAddress } from '@sparx/silica-catalog';
import {
  categorySiteVisibilityWhere,
  collectionSiteVisibilityWhere,
  contentSiteVisibilityWhere,
  productSiteVisibilityWhere,
  withTenant,
} from '@sparx/db';
import type { Prisma } from '@sparx/db';

import type { PropertyContext } from '../errors';

/** A record page's storefront path, per record type — `{'commerce.product':
 *  '/products/brake-kit'}`. A record type is ABSENT when the tenant has no visible record
 *  of that kind yet; the caller then falls back to the route index. Never a partial path
 *  and never a pattern: an entry here is a URL that resolves. */
export type RecordSamplePaths = Partial<Record<string, string>>;

/** The one segment each address interpolates, read from the row the storefront would
 *  route on. Keyed by `recordType` so a new address without a resolver is a compile
 *  error here rather than a silently missing preview. */
const RESOLVERS: Record<
  RecordAddress['recordType'],
  (tx: Prisma.TransactionClient, propertyId: string) => Promise<string | null>
> = {
  // Active + not deleted — the public PDP's own visibility test.
  'commerce.product': async (tx, propertyId) => {
    const row = await tx.product.findFirst({
      where: { status: 'active', deletedAt: null, ...productSiteVisibilityWhere(propertyId) },
      orderBy: { updatedAt: 'desc' },
      select: { handle: true },
    });
    return row?.handle ?? null;
  },
  'commerce.collection': async (tx, propertyId) => {
    const row = await tx.productCollection.findFirst({
      where: { deletedAt: null, ...collectionSiteVisibilityWhere(propertyId) },
      orderBy: { updatedAt: 'desc' },
      select: { handle: true },
    });
    return row?.handle ?? null;
  },
  'commerce.category': async (tx, propertyId) => {
    const row = await tx.productCategory.findFirst({
      where: { deletedAt: null, ...categorySiteVisibilityWhere(propertyId) },
      orderBy: { updatedAt: 'desc' },
      select: { handle: true },
    });
    return row?.handle ?? null;
  },
  // A published entry of the blog type WITH a slug: apps/site's `/blog/[slug]` route
  // resolves on the slug, so a null-slug entry has no URL to preview.
  'cms.blog_post': async (tx, propertyId) => {
    const row = await tx.contentEntry.findFirst({
      where: {
        typeKey: 'blog_post',
        status: 'published',
        deletedAt: null,
        slug: { not: null },
        ...contentSiteVisibilityWhere(propertyId),
      },
      orderBy: { updatedAt: 'desc' },
      select: { slug: true },
    });
    return row?.slug ?? null;
  },
  // Scheduling routes on the service ID, not a handle — and `/book/:serviceId` is only
  // reachable for a service the site actually offers online. `propertyId: null` is the
  // tenant-wide service (docs/131 §4), which every site offers.
  'scheduling.service': async (tx, propertyId) => {
    const row = await tx.schedulingService.findFirst({
      where: {
        isActive: true,
        bookableOnline: true,
        OR: [{ propertyId }, { propertyId: null }],
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    return row?.id ?? null;
  },
};

/**
 * A real storefront path for every record address the tenant can currently fill.
 *
 * Reads sequentially rather than through `Promise.all`: the five queries share ONE
 * interactive transaction, and concurrent use of a single Prisma tx client is
 * unsupported — the same reason `bindingService.getSchema` sequences its reads.
 *
 * A resolver that throws is not allowed to take the others down with it. Preview is a
 * convenience, and a module whose table is missing or whose query trips should cost that
 * one address its sample, not the whole set — the caller falls back to the route index,
 * which is exactly where it was before this existed.
 */
export function recordSamplePaths(ctx: PropertyContext): Promise<RecordSamplePaths> {
  return withTenant(ctx, async (tx) => {
    const paths: RecordSamplePaths = {};
    for (const address of RECORD_ADDRESSES) {
      try {
        const segment = await RESOLVERS[address.recordType](tx, ctx.propertyId);
        if (segment) paths[address.recordType] = `${address.prefix}${segment}`;
      } catch {
        // Leave this address unresolved — see the note above.
      }
    }
    return paths;
  });
}
