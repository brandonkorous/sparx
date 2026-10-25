// PUBLIC standing of a plan's introductory offer — how many places are left.
//
//   GET /v1/public/billing/offer?plan=<plan id>
//
// Unauthenticated by design: it returns one number a marketing page prints, and
// no tenant data. Read from the Stripe coupon (the only counter that cannot be
// over-promised), per pod, stale-while-revalidate and warmed at boot (lib/offer-standings).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { ok } from '@wizeworks/api-core/envelope';

import { offerStandingFor } from '../../../lib/offer-standings.js';

const Query = z.object({ plan: z.string().trim().min(1).max(60) });

const publicBillingOfferRoutes: FastifyPluginAsync = (app) => {
  app.get(
    '/v1/public/billing/offer',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { plan } = Query.parse(request.query);
      const offer = await offerStandingFor(plan);
      reply.header('cache-control', 'public, max-age=60, stale-while-revalidate=120');
      return ok({ offer });
    }
  );

  return Promise.resolve();
};

export default publicBillingOfferRoutes;
