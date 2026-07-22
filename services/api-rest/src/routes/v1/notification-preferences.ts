// Notification preferences — per-person delivery choices.
//
//   GET /v1/me/notification-preferences  → { channels, digest }
//   PUT /v1/me/notification-preferences  → patch channels and/or digest
//
// Scoped to the CALLING USER, like the inbox itself — a notification is
// addressed to one person, so its delivery choices are that person's, not the
// tenant's. Stored on `users.preferences` (see lib/notification-preferences.ts),
// which is ENABLE + NO FORCE RLS with a `tenant_id = current_tenant_id()`
// policy: Better Auth (sparx_owner) bypasses it but api-rest runs as sparx_app
// and is subject to it, so every read/write goes through `withRequestTenant` to
// set the tenant GUC — a bare `prisma.user.*` here sees zero rows.
//
// An API-key / MCP caller is not a person and has no inbox, so it has no
// preferences either: it reads the defaults and cannot write.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@sparx/db';
import { withRequestTenant } from '@sparx/api-core/db';
import { ok } from '@sparx/api-core/envelope';
import { requireAuth } from '@sparx/api-core/auth';
import { badRequest } from '@sparx/api-core/errors';

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  EMAIL_DIGESTS,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  mergeNotificationPreferences,
  parseNotificationPreferences,
} from '../../lib/notification-preferences.js';

const ChannelEnum = z.enum(NOTIFICATION_CHANNELS);
const DigestEnum = z.enum(EMAIL_DIGESTS);

const PreferencesPatch = z
  .object({
    // A partial map: the client may send the whole set or just what changed.
    // Unknown category keys are rejected rather than silently dropped, so a
    // typo surfaces instead of quietly saving nothing.
    channels: z.record(z.enum(NOTIFICATION_CATEGORIES), ChannelEnum).optional(),
    digest: DigestEnum.optional(),
  })
  .refine((body) => body.channels !== undefined || body.digest !== undefined, {
    message: 'Provide at least one of `channels` or `digest`.',
  });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; route registration is sync.
const notificationPreferenceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/me/notification-preferences', async (request) => {
    const auth = requireAuth(request);
    if (!auth.actorId) return ok(DEFAULT_NOTIFICATION_PREFERENCES);
    const userId = auth.actorId;

    const row = await withRequestTenant(request, (tx) =>
      tx.user.findUnique({ where: { id: userId }, select: { preferences: true } })
    );
    return ok(parseNotificationPreferences(row?.preferences ?? null));
  });

  app.put('/v1/me/notification-preferences', async (request) => {
    const auth = requireAuth(request);
    if (!auth.actorId) throw badRequest('An API key has no notification inbox to configure.');
    const userId = auth.actorId;

    const patch = PreferencesPatch.parse(request.body);

    const next = await withRequestTenant(request, async (tx) => {
      const before = await tx.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });
      const { merged, next: resolved } = mergeNotificationPreferences(
        before?.preferences ?? null,
        patch
      );
      await tx.user.update({
        where: { id: userId },
        data: { preferences: merged as Prisma.InputJsonObject },
      });
      return resolved;
    });

    return ok(next);
  });
};

export default notificationPreferenceRoutes;
