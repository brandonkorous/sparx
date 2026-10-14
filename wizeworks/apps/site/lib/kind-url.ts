// Where a content kind's pieces live, and the kind read that says so.
//
// Its own file because BOTH page tiers link cards with it: the silica loader
// (`silica-data.ts`) and the older builder loader (`builder-data.ts`), which
// `kind-pieces.ts` itself imports from. Keeping this free of either avoids a loop.

import { kindAddressFromPattern, kindPath, type KindFieldLike } from '@wizeworks/silica-catalog';

import { publicGet } from './content';

export interface KindRow {
  key: string;
  name: string;
  pluralName: string;
  urlPattern: string | null;
  schemaJson: { fields?: KindFieldLike[] } | null;
}

/** A kind by key, for the cards that list its pieces — or null when the read fails, in
 *  which case a card shows the stored values and links nowhere, as it did before. */
export async function getPublicKind(tenantSlug: string, key: string): Promise<KindRow | null> {
  try {
    return await publicGet<KindRow>(
      `/v1/public/content/types/${encodeURIComponent(key)}`,
      { tenant: tenantSlug },
      { tag: `content-type:${tenantSlug}:${key}` }
    );
  } catch {
    return null;
  }
}

/** Where one piece of a kind lives, from the kind's pattern. The built-in blog post has
 *  its own route; a pattern the website cannot serve gives no address, never a 404. */
export function pieceUrl(
  typeKey: string,
  urlPattern: string | null | undefined,
  slug: string | null | undefined
): string {
  if (!slug) return '';
  if (typeKey === 'blog_post') return `/blog/${slug}`;
  const address = kindAddressFromPattern(urlPattern);
  return address ? kindPath(address, slug) : '';
}
