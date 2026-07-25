// Revision history.
//
//   GET  /v1/content/entries/:id/revisions                → list (metadata only)
//   GET  /v1/content/entries/:id/revisions/:n             → full body
//   POST /v1/content/entries/:id/revisions/:n/restore     → new revision from old
//
// Restore is non-destructive: it copies an old revision's body/seo back onto
// the entry and records a new revision summarising the restore, so the
// revision history reads chronologically.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { withRequestTenant } from '@sparx/api-core/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound } from '@sparx/api-core/errors';
import {
  restoreRevisionTx,
  serializeEntry,
  serializeRevisionFull,
  serializeRevisionMeta,
} from '@sparx/cms';
import { writeAudit } from '@sparx/api-core/audit';

const ListParams = z.object({ id: z.string().uuid() });
const OneParams = z.object({
  id: z.string().uuid(),
  n: z.coerce.number().int().positive(),
});

const revisionRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/content/entries/:id/revisions', async (request) => {
    requireRole(request, 'viewer');
    const { id } = ListParams.parse(request.params);
    const rows = await withRequestTenant(request, async (tx) => {
      const entry = await tx.contentEntry.findFirst({
        where: { id, deletedAt: null },
        select: { id: true },
      });
      if (!entry) throw notFound('Entry', id);
      return tx.contentRevision.findMany({
        where: { entryId: id },
        orderBy: { revisionNumber: 'desc' },
        take: 100,
      });
    });
    return ok(rows.map(serializeRevisionMeta));
  });

  app.get('/v1/content/entries/:id/revisions/:n', async (request) => {
    requireRole(request, 'viewer');
    const { id, n } = OneParams.parse(request.params);
    const row = await withRequestTenant(request, async (tx) => {
      const entry = await tx.contentEntry.findFirst({
        where: { id, deletedAt: null },
        select: { id: true },
      });
      if (!entry) throw notFound('Entry', id);
      return tx.contentRevision.findFirst({
        where: { entryId: id, revisionNumber: n },
      });
    });
    if (!row) throw notFound('Revision', `${id}#${n}`);
    return ok(serializeRevisionFull(row));
  });

  app.post('/v1/content/entries/:id/revisions/:n/restore', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id, n } = OneParams.parse(request.params);

    const updated = await withRequestTenant(request, async (tx) => {
      const { entry } = await restoreRevisionTx(
        tx,
        { tenantId: auth.tenantId, actorId: auth.actorId },
        id,
        n
      );
      await writeAudit(tx, request, auth, {
        action: 'content.entry.restored',
        entityType: 'content_entry',
        entityId: entry.id,
        before: { revisionNumber: 'current' },
        after: { restoredFrom: n },
      });
      return entry;
    });

    return ok(serializeEntry(updated));
  });
  return Promise.resolve();
};

export default revisionRoutes;
