// PUBLIC standing of a plan's introductory offer — how many places are left.
//
//   GET /v1/public/billing/offer?plan=<plan id>
//
// Unauthenticated by design: it returns one number a marketing page prints, and
// no tenant data. Read from the Stripe coupon (the only counter that cannot be
// over-promised), cached a minute per pod so a busy page is not a Stripe call
// per visitor.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { listBillingPlans, offerStanding, type OfferStanding } from '@wizeworks/billing';
import { ok } from '@wizeworks/api-core/envelope';

import { createTtlCache } from '../../../lib/ttl-cache.js';

const Query = z.object({ plan: z.string().trim().min(1).max(60) });

const standings = createTtlCache<OfferStanding | null>({ hitTtlMs: 60_000, maxEntries: 50 });

/** A plan id nobody configured has no offer, rather than a 500 for a typo. */
async function standingFor(planId: string): Promise<OfferStanding | null> {
  const plan = listBillingPlans().find((p) => p.id === planId);
  return plan ? offerStanding(plan) : null;
}

const publicBillingOfferRoutes: FastifyPluginAsync = (app) => {
  app.get(
    '/v1/public/billing/offer',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { plan } = Query.parse(request.query);
      const offer = await standings.get(plan, () => standingFor(plan));
      reply.header('cache-control', 'public, max-age=60, stale-while-revalidate=120');
      return ok({ offer });
    }
  );

  return Promise.resolve();
};

export default publicBillingOfferRoutes;
