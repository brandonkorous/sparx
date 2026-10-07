// Keeping a site's pages findable from the console's search box.
//
// The box says it searches everything, and when nothing matches it says
// "Nothing in your records matches". Gillett Diesel typed "About" with the About
// page open in the editor behind it and got that sentence (sparx persona issue
// 130): pages were never in the index.
//
// Pages are written from many places: the editor's whole-site save, a single
// page's settings, publish, a blueprint install, a reset, the MCP tools, and
// the starter pages a new site is given the first time it is opened. Any of
// them can add, rename, re-address, publish or remove a page. So a write is
// signalled per SITE, not per row: every page the site held before the write
// or holds after it. A removed page is in the "before" set; its projection
// comes back empty, which the indexer reads as "remove this document".
//
// Call `withPageSearch` around a write, or `indexSitePages` after a read path
// that seeded pages. Both run after the transaction commits, and neither can
// fail the caller: `indexEntity` detaches the publish.

import { withTenant } from '@wizeworks/db';
import { indexEntity } from '@wizeworks/events';

import type { PropertyContext } from '../errors';

async function sitePageIds(ctx: PropertyContext): Promise<string[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.builderPage.findMany({ where: { propertyId: ctx.propertyId }, select: { id: true } })
  );
  return rows.map((r) => r.id);
}

/** Ask search to re-read each of these pages. */
export function indexPages(ctx: PropertyContext, ids: Iterable<string>): void {
  for (const id of new Set(ids)) {
    void indexEntity({
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      entityType: 'builder_page',
      recordId: id,
    });
  }
}

/** Ask search to re-read every page this site holds now. */
export async function indexSitePages(ctx: PropertyContext): Promise<void> {
  indexPages(ctx, await sitePageIds(ctx));
}

/** Run a write to this site's pages, then ask search to re-read every page the
 *  site held before it or holds after it. */
export async function withPageSearch<T>(ctx: PropertyContext, write: () => Promise<T>): Promise<T> {
  const before = await sitePageIds(ctx);
  const result = await write();
  indexPages(ctx, [...before, ...(await sitePageIds(ctx))]);
  return result;
}
