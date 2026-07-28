// Saved hashtag blocks (docs/social-audit slice 19).
//
// The single most-repeated typing in social posting, and the thing a business gets
// subtly wrong every time it retypes from memory — a missing tag, a typo in the branded
// one, a different order. A set is just a named list of tags the composer can drop into
// a post or (more usefully) its first comment in one click.
//
// Tags are stored WITHOUT the leading '#', normalized on write. That is what makes
// "#NewArrival" and "newarrival" the same tag, keeps a set comparable, and leaves the UI
// free to render them however it likes.

import { withTenant } from '@sparx/db';
import { badRequest } from '@sparx/api-core/errors';

import type { SocialContext } from './context.js';

export interface HashtagSetView {
  id: string;
  propertyId: string | null;
  name: string;
  tags: string[];
  /** Narrows the set to one platform; null = offer it everywhere. */
  platform: string | null;
  updatedAt: string;
}

/**
 * Clean one tag: drop the leading hashes, strip whitespace and anything a platform
 * would not accept in a tag, and lower-case it so the same tag typed two ways is one
 * tag. Returns null for something that isn't a usable tag at all.
 */
export function normalizeTag(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^#+/, '')
    // Platforms accept letters, digits and underscore; everything else ends the tag.
    .replace(/[^\p{L}\p{N}_]/gu, '');
  if (!cleaned) return null;
  return cleaned.slice(0, 100).toLowerCase();
}

/** Normalize a whole block, de-duplicated, order preserved (order is authored intent —
 *  the first tags are the ones that survive a platform's cap). */
export function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of raw) {
    const clean = normalizeTag(tag);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out.slice(0, 60);
}

/** Render a set as the text that actually goes in a post. */
export function tagsToText(tags: string[]): string {
  return tags.map((t) => `#${t}`).join(' ');
}

function toView(row: {
  id: string;
  propertyId: string | null;
  name: string;
  tags: string[];
  platform: string | null;
  updatedAt: Date;
}): HashtagSetView {
  return {
    id: row.id,
    propertyId: row.propertyId,
    name: row.name,
    tags: row.tags,
    platform: row.platform,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The sets available to a site: its own, plus any tenant-wide ones. */
export async function listHashtagSets(
  ctx: SocialContext,
  propertyId: string | null
): Promise<HashtagSetView[]> {
  const rows = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialHashtagSet.findMany({
      where: {
        tenantId: ctx.tenantId,
        // A tenant-wide set (property null) belongs to every site; a site's own sets are
        // its alone. Same visibility rule the rest of the module uses.
        ...(propertyId ? { OR: [{ propertyId }, { propertyId: null }] } : {}),
      },
      orderBy: { name: 'asc' },
    })
  );
  return rows.map(toView);
}

export interface UpsertHashtagSetInput {
  id?: string;
  propertyId?: string | null;
  name: string;
  tags: string[];
  platform?: string | null;
}

export async function upsertHashtagSet(
  ctx: SocialContext,
  input: UpsertHashtagSetInput
): Promise<HashtagSetView> {
  const name = input.name.trim();
  if (!name) throw badRequest('Give this set a name so you can find it again.');
  const tags = normalizeTags(input.tags);
  if (tags.length === 0) throw badRequest('Add at least one hashtag to this set.');

  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    if (input.id) {
      const existing = await tx.socialHashtagSet.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!existing) throw badRequest('That hashtag set no longer exists.');
      const row = await tx.socialHashtagSet.update({
        where: { id: input.id },
        data: { name, tags, platform: input.platform ?? null },
      });
      return toView(row);
    }
    const row = await tx.socialHashtagSet.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: input.propertyId ?? null,
        name,
        tags,
        platform: input.platform ?? null,
      },
    });
    return toView(row);
  });
}

export async function deleteHashtagSet(ctx: SocialContext, id: string): Promise<boolean> {
  const result = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialHashtagSet.deleteMany({ where: { id, tenantId: ctx.tenantId } })
  );
  return result.count > 0;
}
