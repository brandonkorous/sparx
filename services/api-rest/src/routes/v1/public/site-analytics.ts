// First-party site analytics — public ingestion (docs/97 §5, docs/08).
//
//   POST /v1/public/site/collect?tenant=<slug>
//     body: { path, referrer?, type?, property? }
//
// The storefront beacon (apps/site) calls this on each pageview. Cookieless +
// PII-free: the visitor hash is derived server-side from the request IP + UA and
// the IP is never stored (lib/site-analytics.ts). Do-Not-Track and obvious bots
// are accepted-and-dropped (204, so the beacon never retries). The tenant is
// resolved from the `?tenant=` slug; the property from the posted slug (else the
// tenant's primary site). RLS scopes the insert to the resolved tenant.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';

import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import {
  classifySource,
  deriveVisitor,
  isBot,
  isDoNotTrack,
  normalizePath,
  referrerHost,
} from '../../../lib/site-analytics.js';

const CollectBody = z.object({
  path: z.string().min(1).max(2048),
  referrer: z.string().max(2048).optional(),
  type: z.enum(['pageview', 'signup']).optional(),
  property: z.string().min(1).max(63).optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const siteAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/v1/public/site/collect', async (request, reply) => {
    // Honor Do-Not-Track + drop obvious bots before doing any work. Accept-and-
    // drop with 204 so the beacon treats it as success and never retries.
    const userAgent = request.headers['user-agent'] ?? '';
    if (isDoNotTrack(request.headers.dnt) || isBot(userAgent)) {
      return reply.code(204).send();
    }

    const body = CollectBody.parse(request.body);
    const tenantId = await resolveTenantId(request);

    const selfHost =
      (request.headers['x-forwarded-host'] as string | undefined) ?? request.headers.host ?? null;
    const refHost = referrerHost(body.referrer);
    const source = classifySource(refHost, selfHost);
    const now = new Date();
    const { visitorHash, sessionHash } = deriveVisitor(tenantId, request.ip, userAgent, now);
    const country =
      (request.headers['x-country'] as string | undefined)?.slice(0, 2).toUpperCase() ?? null;

    await withTenant({ tenantId }, async (tx) => {
      const property = await tx.property.findFirst({
        where: body.property ? { slug: body.property } : { isPrimary: true },
        select: { id: true },
      });
      // If a named property slug didn't resolve, fall back to the primary site so
      // the hit is never silently dropped.
      const propertyId =
        property?.id ??
        (await tx.property.findFirst({ where: { isPrimary: true }, select: { id: true } }))?.id ??
        null;

      await tx.siteAnalyticsEvent.create({
        data: {
          tenantId,
          propertyId,
          type: body.type ?? 'pageview',
          path: normalizePath(body.path),
          source,
          referrerHost: refHost,
          visitorHash,
          sessionHash,
          country,
        },
      });
    });

    return reply.code(204).send();
  });
};

export default siteAnalyticsRoutes;
