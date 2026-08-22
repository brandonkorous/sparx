// PUBLIC header notice — what a brand's surfaces put above the page right now.
//
//   GET /v1/public/announcements?brand=piggles&surface=marketing
//
// Unauthenticated and unauthenticated-by-design: every field it returns is
// already printed on a public web page, so there is nothing here to protect.
// It carries no tenant context and never touches a tenant table.
//
// Returns AT MOST ONE announcement — see `activeAnnouncement`. A surface asking
// this question wants to know what to render, not what exists.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { ok } from '@wizeworks/api-core/envelope';

import { activeAnnouncement, ANNOUNCEMENT_SURFACES } from '../../../lib/announcements.js';

const Query = z.object({
  /** Which product is asking — `sparx` | `piggles`. Required: a notice written
   *  for one brand appearing over the other is the whole failure this guards. */
  brand: z.string().trim().min(1).max(30),
  surface: z.enum(ANNOUNCEMENT_SURFACES),
});

const publicAnnouncementRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/announcements', async (request, reply) => {
    const { brand, surface } = Query.parse(request.query);
    const announcement = await activeAnnouncement(brand, surface);

    // A minute. Long enough that a marketing page under load is not asking the
    // database on every render, short enough that switching a notice off in the
    // console is felt while the operator is still looking at the screen.
    reply.header('cache-control', 'public, max-age=60, stale-while-revalidate=300');
    return ok({ announcement });
  });

  return Promise.resolve();
};

export default publicAnnouncementRoutes;
