// First-party site analytics — public ingestion (docs/97 §5, docs/08).
//
//   POST /v1/public/site/collect?tenant=<slug>
//     body: { path, referrer?, type?, property?, utmMedium?, utmCampaign?, metrics? }
//     body (type='funnel_stage'): + { funnelId, stageKey, email }
//
// The storefront beacon (wizeworks/apps/site) calls this on each pageview, and once per
// page load with `type:'vital'` + a `metrics` map (web-vitals RUM). Cookieless +
// PII-free: the visitor hash is derived server-side from the request IP + UA and
// the IP is never stored (lib/site-analytics.ts). Do-Not-Track and obvious bots
// are accepted-and-dropped (204, so the beacon never retries). The tenant is
// resolved from the `?tenant=` slug; the property from the posted slug (else the
// tenant's primary site). RLS scopes the insert to the resolved tenant.
//
// ── type='funnel_stage' IS A DIFFERENT ANIMAL ───────────────────────────────
//
// Every other type here is anonymous and writes a site_analytics_event. A
// funnel stage is the opposite: it writes NO analytics row, and it names a
// person, because it is the moment a visitor voluntarily stopped being
// anonymous (docs/151 §4, docs/152 B3). It rides on this endpoint because the
// beacon is already the site's one channel back to us, and because the entry
// attribution it needs is derived from exactly the traffic this endpoint
// recorded.
//
// The public body may name ONLY an email address. Two things it deliberately
// cannot carry, because this route is unauthenticated and anyone can POST to it:
//
//   · a customer id  — that would let a script file invented history against a
//     real contact record, chosen by id.
//   · a value        — that would let a visitor declare what their own
//     conversion was worth, straight into the tenant's revenue reporting.
//
// Both come from the server side, in the flows that actually know them.

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@wizeworks/db';

import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import { captureFunnelStage } from '../../../lib/funnel-entry.js';
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
  type: z.enum(['pageview', 'signup', 'vital', 'funnel_stage']).optional(),
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
  // type='funnel_stage' only. `email` is the ONLY identity a public caller may
  // supply — see the header for the two it may not.
  funnelId: z.string().uuid().optional(),
  stageKey: z.string().min(1).max(63).optional(),
  email: z.string().email().max(255).optional(),
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
  app.post(
    '/v1/public/site/collect',
    {
      // A page load fires this a couple of times; a funnel stage fires it once
      // per form. The cap is a coarse backstop against a script spraying stage
      // rows, and it is coarse for the reason the forms endpoint's is: without
      // X-Forwarded-For from the site proxy every visitor shares one pod IP.
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      // Drop obvious bots before doing any work. Accept-and-drop with 204 so the
      // beacon treats it as success and never retries.
      const userAgent = request.headers['user-agent'] ?? '';
      if (isBot(userAgent)) return reply.code(204).send();

      const body = CollectBody.parse(request.body);
      const tenantId = await resolveTenantId(request);

      // Do-Not-Track suppresses TRACKING, and a funnel stage is not tracking:
      // somebody typed their address into this tenant's form and pressed send.
      // Honoring DNT by discarding that would lose the tenant a lead the visitor
      // deliberately gave them. The entry attribution below still finds nothing
      // for a DNT visitor, because the beacon never recorded their pageviews —
      // which is DNT working, one layer down, with no special case needed here.
      if (body.type === 'funnel_stage') {
        return handleFunnelStage(request, reply, tenantId, body, userAgent);
      }
      if (isDoNotTrack(request.headers.dnt)) return reply.code(204).send();

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
    }
  );
};

/**
 * Record one funnel stage for a person who just identified themselves.
 *
 * Always 204, exactly like every other branch of this endpoint. A beacon has no
 * way to act on an error and would only retry into the same one, and the caller
 * is a marketing page rather than an integration — so "the funnel is paused" and
 * "that key is not on this ladder" are answered by writing nothing and saying
 * nothing, with the reason logged at debug for whoever is looking.
 */
async function handleFunnelStage(
  request: FastifyRequest,
  reply: FastifyReply,
  tenantId: string,
  body: z.infer<typeof CollectBody>,
  userAgent: string
): Promise<never> {
  const { funnelId, stageKey, email } = body;
  if (!funnelId || !stageKey || !email) return reply.code(204).send();

  // The funnel has to belong to the site that posted. Same tenant is not enough:
  // a script that learned one funnel id could otherwise spray stages at it from
  // any of the tenant's other sites, and the row would be filed under the
  // funnel's own property while the traffic came from somewhere else.
  const property = await resolvePostedProperty(tenantId, body.property);
  const belongs =
    property !== null &&
    (await withTenant({ tenantId }, (tx) =>
      tx.funnel.findFirst({ where: { id: funnelId, propertyId: property }, select: { id: true } })
    ));
  if (!belongs) return reply.code(204).send();

  await captureFunnelStage({
    log: request.log,
    tenantId,
    funnelId,
    stageKey,
    // The only identity a public body may name. No customer id and no value —
    // see the file header.
    subjectEmail: email,
    ip: request.ip,
    userAgent,
    now: new Date(),
  });

  return reply.code(204).send();
}

/** The posted site, or the tenant's primary. Null when the tenant has neither,
 *  which is a tenant with no site and therefore no funnel to post to. */
async function resolvePostedProperty(tenantId: string, slug: string | undefined) {
  return withTenant({ tenantId }, async (tx) => {
    const named = slug
      ? await tx.property.findFirst({ where: { slug }, select: { id: true } })
      : null;
    const resolved =
      named ?? (await tx.property.findFirst({ where: { isPrimary: true }, select: { id: true } }));
    return resolved?.id ?? null;
  });
}

export default siteAnalyticsRoutes;
