// The authors a site has a page for: everyone with something published on it, written
// or credited. The public author list and the site check's link roster ask the same
// question, so it is asked here once.

import type { Prisma, TxClient } from '@wizeworks/db';

import { creditWhere, servedKinds, type ServedKindInfo } from './author-credits.js';
import { contentSiteVisibilityWhere } from './property.js';

export const AUTHOR_SELECT = {
  id: true,
  slug: true,
  displayName: true,
  bio: true,
  avatarAssetId: true,
} as const;

/** The kinds the website serves pieces of on this site, by key. */
export async function siteKindsTx(
  tx: TxClient,
  propertyId: string
): Promise<Map<string, ServedKindInfo>> {
  const rows = await tx.contentType.findMany({
    where: { isSingleton: false, OR: [{ propertyId: null }, { propertyId }] },
    orderBy: [{ isBuiltIn: 'asc' }, { key: 'asc' }],
    select: { key: true, name: true, pluralName: true, urlPattern: true, schemaJson: true },
  });
  return servedKinds(rows);
}

/** A published piece of a served kind, on this site. */
export function publishedOnSite(
  propertyId: string,
  kinds: Map<string, ServedKindInfo>
): Prisma.ContentEntryWhereInput {
  return {
    status: 'published',
    deletedAt: null,
    typeKey: { in: [...kinds.keys()] },
    ...contentSiteVisibilityWhere(propertyId),
  };
}

export interface AuthorWithWork {
  slug: string;
  display_name: string;
  bio: string | null;
  avatar_asset_id: string | null;
  written: number;
  credited: number;
}

/** Every author of this site with something published, writers first. */
export async function authorsWithWorkTx(
  tx: TxClient,
  propertyId: string
): Promise<AuthorWithWork[]> {
  const kinds = await siteKindsTx(tx, propertyId);
  const authors = await tx.author.findMany({
    where: { OR: [{ propertyId: null }, { propertyId }] },
    orderBy: { displayName: 'asc' },
    take: 200,
    select: AUTHOR_SELECT,
  });
  const live = publishedOnSite(propertyId, kinds);
  const written = await tx.contentEntry.groupBy({
    by: ['authorId'],
    where: { ...live, authorId: { in: authors.map((a) => a.id) } },
    _count: { _all: true },
  });
  const writtenBy = new Map(written.map((w) => [w.authorId, w._count._all]));
  const rows: AuthorWithWork[] = [];
  for (const author of authors) {
    const branches = creditWhere(kinds.values(), author.id);
    const credited =
      branches.length === 0
        ? 0
        : await tx.contentEntry.count({ where: { AND: [live, { OR: branches }] } });
    const pieces = writtenBy.get(author.id) ?? 0;
    if (pieces + credited === 0) continue;
    rows.push({
      slug: author.slug,
      display_name: author.displayName,
      bio: author.bio,
      avatar_asset_id: author.avatarAssetId,
      written: pieces,
      credited,
    });
  }
  // A masthead: the writers first, by how much they have written, then everyone
  // credited for other work.
  return rows.sort(
    (a, b) =>
      b.written - a.written ||
      b.credited - a.credited ||
      a.display_name.localeCompare(b.display_name)
  );
}
