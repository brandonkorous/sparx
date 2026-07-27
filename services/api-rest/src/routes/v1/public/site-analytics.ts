// First-party site analytics — public ingestion (docs/97 §5, docs/08).
//
//   POST /v1/public/site/collect?tenant=<slug>
//     body: { path, referrer?, type?, property?, utmMedium?, utmCampaign?, metrics? }
//
// The storefront beacon (apps/site) calls this on each pageview, and once per
// page load with `type:'vital'` + a `metrics` map (web-vitals RUM). Cookieless +
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
  normalizeCampaign,
  normalizePath,
  referrerHost,
} from '../../../lib/site-analytics.js';

const CollectBody = z.object({
  path: z.string().min(1).max(2048),
  referrer: z.string().max(2048).optional(),
  type: z.enum(['pageview', 'signup', 'vital']).optional(),
  property: z.string().min(1).max(63).optional(),
  // Email-link attribution (docs/impl transactional-email Slice 10): the beacon
  // forwards the landing URL's `utm_medium` / `utm_campaign` (the ONLY utm keys we
  // read — the rest of the query string is never sent or stored). A hit with
  // `utm_medium=email` is classified `email` and its campaign recorded.
  utmMedium: z.string().max(64).optional(),
  utmCampaign: z.string().max(128).optional(),
  // Web-vitals RUM (type='vital' only): metric name → value. Server-validated
  // against the allowlist + sane bounds below before any row is written.
  metrics: z.record(z.string().max(16), z.number().finite()).optional(),
});

// Accepted vitals + their max sane value (drops garbage / adversarial outliers).
// Timing metrics are milliseconds; cls is a unitless score.
const VITAL_MAX: Record<string, number> = {
  load: 600_000,
  lcp: 600_000,
  fcp: 600_000,
  ttfb: 600_000,
  inp: 600_000,
  cls: 100,
};

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
    const source = classifySource(refHost, selfHost, body.utmMedium);
    // Campaign is meaningful only for an email-sourced hit; every other source
    // leaves it null.
    const campaign = source === 'email' ? normalizeCampaign(body.utmCampaign) : null;
    const now = new Date();
    const { visitorHash, sessionHash } = deriveVisitor(tenantId, request.ip, userAgent, now);
    const country =
      (request.headers['x-country'] as string | undefined)?.slice(0, 2).toUpperCase() ?? null;

    const type = body.type ?? 'pageview';
    const path = normalizePath(body.path);

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

      const base = {
        tenantId,
        propertyId,
        path,
        source,
        campaign,
        referrerHost: refHost,
        visitorHash,
        sessionHash,
        country,
      };

      if (type === 'vital') {
        // One row per accepted metric; values out of allowlist/bounds are dropped.
        const rows = Object.entries(body.metrics ?? {}).flatMap(([metric, value]) => {
          const max = VITAL_MAX[metric];
          if (max === undefined || value < 0 || value > max) return [];
          return [{ ...base, type: 'vital', metric, value }];
        });
        if (rows.length > 0) await tx.siteAnalyticsEvent.createMany({ data: rows });
        return;
      }

      await tx.siteAnalyticsEvent.create({ data: { ...base, type } });
    });

    return reply.code(204).send();
  });
};

export default siteAnalyticsRoutes;
