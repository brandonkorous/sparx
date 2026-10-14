// Starter pages the owner deleted, so they stay deleted.
//
// The site serves a starter address (`/blog`, `/about`) from the platform's own design
// when the property has no page there, and the page list makes a row for every starter
// address the site serves. So deleting the design's `/blog` page did nothing: the site
// kept serving it, the list made it again within the second, and the delete warning
// ("that address stops working") was false. A journal could not get rid of a blog page
// it does not use (persona issue 947).
//
// The property remembers the addresses it deleted (`settings.removedPages`). The page
// list does not remake them and the site does not serve them. Making a page at the
// address again ends it: an address with a row is the row's.

import type { TxClient } from '@wizeworks/db';
import { isSiteOwnRoute, starterPages } from '@wizeworks/silica-catalog';

import type { PropertyContext } from '../errors';
import { atAddress } from './page-liveness';

/** Every starter address, whatever this site switched on. */
const ALL_MODULES = { commerceEnabled: true, schedulingEnabled: true, cmsEnabled: true };

/** The deleted starter addresses a property's settings hold, bare (`blog`). */
export function removedStarterPaths(settings: unknown): string[] {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return [];
  const raw = (settings as { removedPages?: unknown }).removedPages;
  return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string') : [];
}

/** Is this an address the site serves from the platform's design with no page there,
 *  and only through the page read? Never the home page (a site always has one), and
 *  never one of the site's own routes (`/cart`, `/search`, `/account/…`), which answer
 *  whether or not a page is there. */
export function isStarterAddress(slug: string | null): boolean {
  const address = atAddress(slug);
  if (address === '' || isSiteOwnRoute(address)) return false;
  return starterPages(ALL_MODULES).some((p) => atAddress(p.slug) === address);
}

async function writeRemoved(tx: TxClient, ctx: PropertyContext, paths: string[]): Promise<void> {
  const row = await tx.property.findUnique({
    where: { id: ctx.propertyId },
    select: { settings: true },
  });
  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  await tx.property.update({
    where: { id: ctx.propertyId },
    data: { settings: { ...settings, removedPages: paths } },
  });
}

/** The property's deleted starter addresses. */
export async function removedStartersTx(tx: TxClient, ctx: PropertyContext): Promise<string[]> {
  const row = await tx.property.findUnique({
    where: { id: ctx.propertyId },
    select: { settings: true },
  });
  return removedStarterPaths(row?.settings);
}

/** Remember that the owner deleted the page at this starter address. */
export async function rememberRemovedStarterTx(
  tx: TxClient,
  ctx: PropertyContext,
  slug: string | null
): Promise<void> {
  if (!isStarterAddress(slug)) return;
  const removed = await removedStartersTx(tx, ctx);
  const address = atAddress(slug);
  if (removed.includes(address)) return;
  await writeRemoved(tx, ctx, [...removed, address]);
}

/** The deleted starter addresses that still have no page, forgetting any she has made a
 *  page at again. */
export async function settleRemovedStartersTx(
  tx: TxClient,
  ctx: PropertyContext,
  rows: readonly { slug: string | null }[]
): Promise<string[]> {
  const removed = await removedStartersTx(tx, ctx);
  if (removed.length === 0) return removed;
  const held = new Set(rows.map((r) => atAddress(r.slug)));
  const still = removed.filter((p) => !held.has(p));
  if (still.length !== removed.length) await writeRemoved(tx, ctx, still);
  return still;
}
