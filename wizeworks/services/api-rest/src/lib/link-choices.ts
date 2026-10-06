// The places a link on this site can point, by the name the owner knows them by.
//
// The editor's link field suggests the site's own builder pages already. Everything
// else the site serves lives outside the builder: the policy pages and other CMS
// pages, the shop's built-in routes, every product, collection and category, blog
// posts and bookable services. Without this list an owner pointing "Returns &
// refunds" at his Refund Policy had to know `/refund-policy` by heart (sparx persona
// issue 042).
//
// The same rosters as the pre-publish check's `linkTargets`, with names, so a link
// picked from this list is one the check will call working. Each roster is gathered
// only when its module is on; a module that is off serves none of these routes.

import type { PropertyContext } from '@wizeworks/builder';
import { isModuleEnabled } from '@wizeworks/auth';
import type { TxClient } from '@wizeworks/db';
import {
  categorySiteVisibilityWhere,
  collectionSiteVisibilityWhere,
  contentSiteVisibilityWhere,
  productSiteVisibilityWhere,
} from './property.js';

export interface LinkChoice {
  /** The address written into the link. */
  href: string;
  /** The name the owner knows the place by. */
  label: string;
}

/** The shop's own routes. They exist on every site with Commerce on, so they are
 *  named here rather than read from anywhere. */
const SHOP_ROUTES: readonly LinkChoice[] = [
  { href: '/products', label: 'All products' },
  { href: '/collections', label: 'All collections' },
  { href: '/search', label: 'Search' },
  { href: '/cart', label: 'Cart' },
];

export async function linkChoices(tx: TxClient, ctx: PropertyContext): Promise<LinkChoice[]> {
  const [commerce, cms, scheduling] = await Promise.all([
    isModuleEnabled(ctx.tenantId, 'commerce').catch(() => false),
    isModuleEnabled(ctx.tenantId, 'cms').catch(() => false),
    isModuleEnabled(ctx.tenantId, 'scheduling').catch(() => false),
  ]);

  const out: LinkChoice[] = [];

  if (cms) {
    const entries = await tx.contentEntry.findMany({
      where: {
        typeKey: { in: ['page', 'blog_post'] },
        status: 'published',
        deletedAt: null,
        slug: { not: null },
        ...contentSiteVisibilityWhere(ctx.propertyId),
      },
      select: { typeKey: true, slug: true, body: true },
    });
    const titled = entries.map((e) => ({
      typeKey: e.typeKey,
      slug: e.slug ?? '',
      title: entryTitle(e.body) ?? e.slug ?? '',
    }));
    for (const e of titled.filter((x) => x.typeKey === 'page').sort(byTitle)) {
      out.push({ href: `/${e.slug}`, label: e.title });
    }
    for (const e of titled.filter((x) => x.typeKey === 'blog_post').sort(byTitle)) {
      out.push({ href: `/blog/${e.slug}`, label: `Post: ${e.title}` });
    }
  }

  if (commerce) {
    out.push(...SHOP_ROUTES);
    const [collections, categories, products] = await Promise.all([
      tx.productCollection.findMany({
        where: { deletedAt: null, ...collectionSiteVisibilityWhere(ctx.propertyId) },
        select: { handle: true, name: true },
        orderBy: { name: 'asc' },
      }),
      tx.productCategory.findMany({
        where: { deletedAt: null, ...categorySiteVisibilityWhere(ctx.propertyId) },
        select: { handle: true, name: true },
        orderBy: { name: 'asc' },
      }),
      tx.product.findMany({
        where: { status: 'active', deletedAt: null, ...productSiteVisibilityWhere(ctx.propertyId) },
        select: { handle: true, title: true },
        orderBy: { title: 'asc' },
      }),
    ]);
    for (const c of collections)
      out.push({ href: `/collections/${c.handle}`, label: `Collection: ${c.name}` });
    for (const c of categories)
      out.push({ href: `/category/${c.handle}`, label: `Category: ${c.name}` });
    for (const p of products)
      out.push({ href: `/products/${p.handle}`, label: `Product: ${p.title}` });
  }

  if (scheduling) {
    out.push({ href: '/book', label: 'Book an appointment' });
    const services = await tx.schedulingService.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    for (const s of services) out.push({ href: `/book/${s.id}`, label: `Book: ${s.name}` });
  }

  return out;
}

function entryTitle(body: unknown): string | null {
  if (body && typeof body === 'object' && 'title' in body) {
    const title = (body as { title?: unknown }).title;
    if (typeof title === 'string' && title.trim()) return title.trim();
  }
  return null;
}

function byTitle(a: { title: string }, b: { title: string }): number {
  return a.title.localeCompare(b.title);
}
