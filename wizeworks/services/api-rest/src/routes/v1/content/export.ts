// Everything written in Content, as a spreadsheet.
//
//   GET /v1/export/content → one row per content entry (posts, pages, legal
//                            pages, and every type the business defined)
//
// A content type is a schema the business can shape however it likes, so no
// fixed set of columns can hold every entry's fields. The fields go out whole,
// as JSON, in one column (`fields`), the same way the SEO settings do: another
// system can read JSON, and a person can still sort and filter on the columns
// every entry has.
//
// Gated exactly like the content list: signed in, viewer or above, and no module
// check. Legal pages live here and exist whether or not the Content module is
// on; a business that switched Content off still owns what it wrote.
//
// Site scope follows the list too: the site the person is working in (the
// `x-sparx-property-id` header), `?property=all` for every site they can reach.

import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@wizeworks/db';
import { z } from 'zod';
import { csvSafeText } from '@wizeworks/inventory';
import { requireRole } from '@wizeworks/api-core/auth';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { contentSiteVisibilityWhere, resolveListScope } from '../../../lib/property.js';
import { EXPORT_ROW_CAP, sendCsvExport } from '../../../lib/record-export.js';

const ExportQuery = z.object({
  type: z.string().max(63).optional(),
  status: z.enum(['draft', 'scheduled', 'published', 'archived']).optional(),
  property: z.string().min(1).optional(),
  take: z.coerce.number().int().min(1).max(EXPORT_ROW_CAP).optional(),
});

/** The entry's own title, when its type has one. Types without a `title` field
 *  get a blank rather than a guess; the slug column still identifies the row. */
function titleOf(body: Prisma.JsonValue): string | null {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const value = (body as Record<string, unknown>).title;
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/require-await
const contentExportRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/export/content', async (request, reply) => {
    const auth = requireRole(request, 'viewer');
    const q = ExportQuery.parse(request.query);
    const propertyId = await resolveListScope(
      auth,
      q.property,
      request.headers['x-sparx-property-id']
    );

    const where: Prisma.ContentEntryWhereInput = {
      deletedAt: null,
      ...(q.type ? { typeKey: q.type } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(propertyId ? contentSiteVisibilityWhere(propertyId) : {}),
    };

    const [entries, types] = await withRequestTenant(request, (tx) =>
      Promise.all([
        tx.contentEntry.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take: q.take ?? EXPORT_ROW_CAP,
          select: {
            typeKey: true,
            slug: true,
            status: true,
            body: true,
            seoJson: true,
            localeCode: true,
            publishedAt: true,
            scheduledAt: true,
            createdAt: true,
            updatedAt: true,
            author: { select: { displayName: true } },
          },
        }),
        // Built-in types sit under the platform tenant and are read-visible to
        // every tenant, so this also names "Blog post" and "Page".
        tx.contentType.findMany({ select: { key: true, name: true } }),
      ])
    );
    const typeName = new Map(types.map((t) => [t.key, t.name]));

    return sendCsvExport(reply, {
      name: 'content',
      headers: [
        'title',
        'type',
        'type_key',
        'slug',
        'status',
        'published_at',
        'scheduled_at',
        'created_at',
        'updated_at',
        'author',
        'locale',
        'fields',
        'seo',
      ],
      rows: entries.map((e) => [
        csvSafeText(titleOf(e.body)),
        typeName.get(e.typeKey) ?? e.typeKey,
        e.typeKey,
        csvSafeText(e.slug),
        e.status,
        e.publishedAt,
        e.scheduledAt,
        e.createdAt,
        e.updatedAt,
        csvSafeText(e.author?.displayName ?? null),
        e.localeCode,
        JSON.stringify(e.body ?? {}),
        JSON.stringify(e.seoJson ?? {}),
      ]),
    });
  });
};

export default contentExportRoutes;
