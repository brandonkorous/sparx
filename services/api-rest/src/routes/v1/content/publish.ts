// Publish / unpublish flows.
//
//   POST /v1/content/entries/:id/publish      { scheduledAt? }
//   POST /v1/content/entries/:id/unpublish
//
// Both flips record a manual revision with a summary so the publish history
// is visible in the dashboard's revision drawer. Emits the appropriate
// Pub/Sub event so the webhook-delivery worker can fan out to subscribers.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withRequestTenant } from '@sparx/api-core/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { publishEntryTx, unpublishEntryTx, serializeEntry } from '@sparx/cms';
import { writeAudit } from '@sparx/api-core/audit';
import { publish } from '@sparx/api-core/pubsub';
import { auditAndStore } from '../../../lib/seo-audit.js';

const PathId = z.object({ id: z.string().uuid() });
const PublishBody = z.object({
  scheduled_at: z.string().datetime({ offset: true }).optional(),
});

const publishRoutes: FastifyPluginAsync = (app) => {
  // ──────────────────────────────────────────────────────────────────────
  // PUBLISH
  // ──────────────────────────────────────────────────────────────────────

  app.post('/v1/content/entries/:id/publish', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const input = PublishBody.parse(request.body ?? {});

    const { entry: updated, events } = await withRequestTenant(request, async (tx) => {
      const before = await tx.contentEntry.findFirst({
        where: { id, deletedAt: null },
        select: { status: true },
      });
      const result = await publishEntryTx(
        tx,
        { tenantId: auth.tenantId, actorId: auth.actorId },
        id,
        { scheduledAt: input.scheduled_at ?? null },
        new Date()
      );
      await writeAudit(tx, request, auth, {
        action:
          result.entry.status === 'scheduled'
            ? 'content.entry.scheduled'
            : 'content.entry.published',
        entityType: 'content_entry',
        entityId: result.entry.id,
        before: { status: before?.status ?? null },
        after: {
          status: result.entry.status,
          publishedAt: result.entry.publishedAt,
          scheduledAt: result.entry.scheduledAt,
        },
      });
      return result;
    });

    for (const ev of events) {
      await publish(request.log, ev.type, auth.tenantId, auth.actorId, ev.data);
    }

    // Refresh the stored SEO snapshot so the overview reflects the now-published
    // entry (docs/50 §7). Best-effort — never fail the publish on a snapshot write.
    await withRequestTenant(request, (tx) =>
      auditAndStore(tx, auth.tenantId, 'cms_page', id)
    ).catch(() => undefined);

    return ok(serializeEntry(updated));
  });

  // ──────────────────────────────────────────────────────────────────────
  // UNPUBLISH (back to draft)
  // ──────────────────────────────────────────────────────────────────────

  app.post('/v1/content/entries/:id/unpublish', async (request) => {
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);

    const { entry: updated, events } = await withRequestTenant(request, async (tx) => {
      const before = await tx.contentEntry.findFirst({
        where: { id, deletedAt: null },
        select: { status: true },
      });
      const result = await unpublishEntryTx(
        tx,
        { tenantId: auth.tenantId, actorId: auth.actorId },
        id
      );
      // unpublishEntryTx is a no-op when the entry is already a draft — only
      // audit an actual transition.
      if (before && before.status !== 'draft') {
        await writeAudit(tx, request, auth, {
          action: 'content.entry.unpublished',
          entityType: 'content_entry',
          entityId: result.entry.id,
          before: { status: before.status },
          after: { status: 'draft' },
        });
      }
      return result;
    });

    for (const ev of events) {
      await publish(request.log, ev.type, auth.tenantId, auth.actorId, ev.data);
    }

    return ok(serializeEntry(updated));
  });
  return Promise.resolve();
};

export default publishRoutes;
