// The people a site's writing is credited to, read for their own pages and for a
// contributors list. One shape for both, so a card and a page say the same thing.

import { authorPath, type KindFieldLike } from '@wizeworks/silica-catalog';

import { formatPublishedDate } from './builder-data';
import { publicGet, type ApiEntry } from './content';
import { pieceImage, pieceSummary, pieceTitle } from './kind-pieces';
import { mediaUrl } from './media';

/** One author, as the public list answers. */
export interface PublicAuthor {
  slug: string;
  display_name: string;
  bio: string | null;
  avatar_asset_id: string | null;
}

export interface PublicAuthorListItem extends PublicAuthor {
  written: number;
  credited: number;
}

/** A piece on an author's page: the entry, its kind, where it lives, and the role when
 *  the author is credited rather than the writer. */
export interface AuthorPiece {
  entry: ApiEntry;
  kind: { key: string; name: string; pluralName: string; fields: KindFieldLike[] };
  path: string | null;
  role: string | null;
}

export interface PublicAuthorPage {
  author: PublicAuthor & { id: string };
  written: AuthorPiece[];
  credited: AuthorPiece[];
}

/** One author and their pieces, or null when they have nothing published here. */
export async function getPublicAuthor(
  tenantSlug: string,
  slug: string
): Promise<PublicAuthorPage | null> {
  try {
    return await publicGet<PublicAuthorPage>(
      '/v1/public/content/authors/by-slug',
      { tenant: tenantSlug, slug },
      { tag: `author:${tenantSlug}:${slug}` }
    );
  } catch (err) {
    if ((err as { code?: string }).code === 'NOT_FOUND') return null;
    throw err;
  }
}

/** Everyone with something published on this site, writers first. */
export function listPublicAuthors(tenantSlug: string): Promise<PublicAuthorListItem[]> {
  return publicGet<PublicAuthorListItem[]>(
    '/v1/public/content/authors',
    { tenant: tenantSlug },
    { tag: `authors:${tenantSlug}` }
  );
}

/** An author's name, biography, portrait and address — what a card and their page show. */
export function authorCard(author: PublicAuthor, tenantSlug: string): Record<string, unknown> {
  const portrait = mediaUrl(author.avatar_asset_id, tenantSlug);
  return {
    name: author.display_name,
    bio: author.bio ?? null,
    portrait: portrait ? { url: portrait, alt: author.display_name } : null,
    url: authorPath(author.slug),
  };
}

/** A piece as a card on an author's page. */
export function authorPieceCard(
  piece: AuthorPiece,
  tenantSlug: string,
  timeZone: string | null,
  locale: string
): Record<string, unknown> {
  const body = piece.entry.body ?? {};
  const title = pieceTitle(piece.kind.fields, body);
  const image = pieceImage(piece.kind.fields, body, tenantSlug);
  return {
    title,
    excerpt: pieceSummary(piece.kind.fields, body) || null,
    featuredImage: image ? { url: image, alt: title } : null,
    date: formatPublishedDate(piece.entry.published_at, timeZone, locale),
    kindName: piece.kind.name,
    role: piece.role,
    url: piece.path ?? '',
  };
}

/** The record an author's page binds as `author`. */
export function authorRecord(
  page: PublicAuthorPage,
  tenantSlug: string,
  timeZone: string | null,
  locale: string
): Record<string, unknown> {
  return {
    ...authorCard(page.author, tenantSlug),
    written: page.written.map((p) => authorPieceCard(p, tenantSlug, timeZone, locale)),
    credited: page.credited.map((p) => authorPieceCard(p, tenantSlug, timeZone, locale)),
  };
}
