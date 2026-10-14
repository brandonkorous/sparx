// The people a site's writing is credited to, for the website's author pages.
//
//   GET /v1/public/content/authors          ?tenant=<slug>[&property=]
//   GET /v1/public/content/authors/by-slug  ?tenant=<slug>&slug=<author>[&property=]
//
// An author is listed only once something they wrote or are credited on is published
// on this site: an author page with nothing on it is a dead end for a reader, and an
// index linking to one is worse. Published-only, like every other public read.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@wizeworks/db';
import { ok } from '@wizeworks/api-core/envelope';
import { notFound } from '@wizeworks/api-core/errors';
import { serializeEntry, PUBLIC_ENTRY_BYLINE_INCLUDE } from '@wizeworks/cms';

import { creditRole, creditWhere } from '../../../lib/author-credits.js';
import {
  AUTHOR_SELECT,
  authorsWithWorkTx,
  publishedOnSite,
  siteKindsTx,
} from '../../../lib/author-roster.js';
import { entryPublicPath } from '../../../lib/content-paths.js';
import { resolvePublicPropertyId } from '../../../lib/property.js';
import { requireTenantIdBySlug } from '../../../lib/tenant-slug.js';

const ListQuery = z.object({
  tenant: z.string().min(1).max(63),
  property: z.string().min(1).max(63).optional(),
});

const BySlugQuery = ListQuery.extend({ slug: z.string().min(1).max(255) });

/** How many pieces an author page lists in each of its two lists. */
const PIECES_CAP = 100;

const authorsRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/content/authors', async (request) => {
    const q = ListQuery.parse(request.query);
    const tenantId = await requireTenantIdBySlug(q.tenant);
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const items = await withTenant({ tenantId }, (tx) => authorsWithWorkTx(tx, propertyId));
    return ok(items);
  });

  app.get('/v1/public/content/authors/by-slug', async (request) => {
    const q = BySlugQuery.parse(request.query);
    const tenantId = await requireTenantIdBySlug(q.tenant);
    const propertyId = await resolvePublicPropertyId(tenantId, q.property);
    const found = await withTenant({ tenantId }, async (tx) => {
      const author = await tx.author.findFirst({
        where: { slug: q.slug, OR: [{ propertyId: null }, { propertyId }] },
        select: AUTHOR_SELECT,
      });
      if (!author) return null;
      const kinds = await siteKindsTx(tx, propertyId);
      const live = publishedOnSite(propertyId, kinds);
      const orderBy = [{ publishedAt: 'desc' as const }, { id: 'desc' as const }];
      const branches = creditWhere(kinds.values(), author.id);
      const [written, credited] = await Promise.all([
        tx.contentEntry.findMany({
          where: { ...live, authorId: author.id },
          orderBy,
          take: PIECES_CAP,
          include: PUBLIC_ENTRY_BYLINE_INCLUDE,
        }),
        branches.length === 0
          ? Promise.resolve([])
          : tx.contentEntry.findMany({
              where: { AND: [live, { OR: branches }] },
              orderBy,
              take: PIECES_CAP,
              include: PUBLIC_ENTRY_BYLINE_INCLUDE,
            }),
      ]);
      const piece = (row: (typeof written)[number]) => {
        const kind = kinds.get(row.typeKey)!;
        const body = (row.body ?? {}) as Record<string, unknown>;
        return {
          entry: serializeEntry(row),
          kind: {
            key: kind.key,
            name: kind.name,
            pluralName: kind.pluralName,
            fields: kind.fields,
          },
          path: entryPublicPath(kind.key, kind.urlPattern, row.slug),
          role: creditRole(kind.credits, body, author.id),
        };
      };
      if (written.length + credited.length === 0) return null;
      return {
        author: {
          id: author.id,
          slug: author.slug,
          display_name: author.displayName,
          bio: author.bio,
          avatar_asset_id: author.avatarAssetId,
        },
        written: written.map(piece),
        credited: credited.map(piece),
      };
    });
    if (!found) throw notFound('Author', q.slug);
    return ok(found);
  });

  return Promise.resolve();
};

export default authorsRoutes;
