// Notifications — "what needs me?" (docs/124 Phase 3).
//
//   GET  /v1/notifications?state=unread|all&limit=  → { items, unreadCount }
//   POST /v1/notifications/:id/read                 → mark one read
//   POST /v1/notifications/read-all                 → mark every unread read
//
// Everything here is scoped to the CALLING USER, not the tenant. That is the
// whole distinction between a notification and an activity row: activity is
// ambient context anyone may read, a notification is addressed to one person
// and carries their read state. A tenant-wide "notifications" list would be a
// category error.
//
// Nothing in this file creates a notification. Rows are derived from the event
// firehose by `notification-worker` — feature code publishes its domain event
// and stops thinking about it, exactly as the email pipeline works.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withRequestTenant } from '@sparx/api-core/db';
import { ok } from '@sparx/api-core/envelope';
import { requireAuth } from '@sparx/api-core/auth';
import { notFound } from '@sparx/api-core/errors';

const ListQuery = z.object({
  state: z.enum(['unread', 'all']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const PathId = z.object({ id: z.string().uuid() });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; route registration is sync.
const notificationRoutes: FastifyPluginAsync = async (app) => {
  // ──────────────────────────────────────────────────────────────────────
  // GET /v1/notifications
  // ──────────────────────────────────────────────────────────────────────
  app.get('/v1/notifications', async (request) => {
    const auth = requireAuth(request);
    const { state, limit } = ListQuery.parse(request.query);

    // An API key or MCP caller is not a person, so it has no inbox. Empty is
    // the honest answer — not an error, and not somebody else's notifications.
    if (!auth.actorId) return ok({ items: [], unreadCount: 0 });
    const userId = auth.actorId;

    const { rows, unreadCount } = await withRequestTenant(request, async (tx) => {
      const [found, unread] = await Promise.all([
        tx.notification.findMany({
          where: { userId, ...(state === 'unread' ? { readAt: null } : {}) },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        // Always the UNREAD count regardless of `state` — it drives the badge,
        // which must not change meaning based on which tab is open.
        tx.notification.count({ where: { userId, readAt: null } }),
      ]);
      return { rows: found, unreadCount: unread };
    });

    return ok({
      items: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        body: row.body,
        module: row.module,
        severity: row.severity,
        entityType: row.entityType,
        entityId: row.entityId,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      unreadCount,
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // POST /v1/notifications/:id/read
  // ──────────────────────────────────────────────────────────────────────
  app.post('/v1/notifications/:id/read', async (request) => {
    const auth = requireAuth(request);
    const { id } = PathId.parse(request.params);
    if (!auth.actorId) throw notFound('Notification', id);
    const userId = auth.actorId;

    const updated = await withRequestTenant(request, async (tx) => {
      // Scoped by userId as well as id: RLS keeps other TENANTS out, but only
      // this predicate keeps a colleague from marking someone else's read.
      const result = await tx.notification.updateMany({
        where: { id, userId, readAt: null },
        data: { readAt: new Date() },
      });
      return result.count;
    });

    // Zero means "not yours, gone, or already read". Already-read is a success
    // for an idempotent action, so this only 404s when the row isn't visible.
    if (updated === 0) {
      const exists = await withRequestTenant(request, async (tx) =>
        tx.notification.findFirst({ where: { id, userId }, select: { id: true } })
      );
      if (!exists) throw notFound('Notification', id);
    }

    return ok({ id, read: true });
  });

  // ──────────────────────────────────────────────────────────────────────
  // POST /v1/notifications/read-all
  // ──────────────────────────────────────────────────────────────────────
  app.post('/v1/notifications/read-all', async (request) => {
    const auth = requireAuth(request);
    if (!auth.actorId) return ok({ read: 0 });
    const userId = auth.actorId;

    const read = await withRequestTenant(request, async (tx) => {
      const result = await tx.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      });
      return result.count;
    });

    return ok({ read });
  });
};

export default notificationRoutes;
