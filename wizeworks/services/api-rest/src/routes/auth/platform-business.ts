// The person's own business, for the app that signs them up and sets it up.
//
//   GET  /auth/<brand>/platform/sign-in-options       → { social }
//   GET  /auth/<brand>/platform/consent               → { consent }
//   POST /auth/<brand>/platform/consent               → { analytics } → { consent }
//   GET  /auth/<brand>/platform/business              → { business }
//   GET  /auth/<brand>/platform/business/capacity     → { capacity }
//   GET  /auth/<brand>/platform/business/billing      → { billing }
//   POST /auth/<brand>/platform/business/billing/checkout → { url } | { url: null, reason }
//   POST /auth/<brand>/platform/business/billing/portal   → { url }
//   GET  /auth/<brand>/platform/business/setup-options    → { blueprints, industries }
//   GET  /auth/<brand>/platform/business/address?slug=    → { verdict }
//   POST /auth/<brand>/platform/business/setup            → the setup answers
//   POST /auth/<brand>/platform/business/brand-settings   → merged into settings[brand]
//   POST /auth/<brand>/platform/business/heard-about      → { answer }
//   POST /auth/<brand>/platform/business/acquisition      → how a new business found us
//   POST /auth/<brand>/platform/business/furnish          → modules, template, sample data
//
// ── WHY HERE ────────────────────────────────────────────────────────────────
//
// The account app did all of this on its own database client, and the two
// calls it could not do (billing, furnishing) through `/internal/tenant/*` with
// a shared token naming a tenant id. Both are gone (docs/154): an app holds no
// database and no secret, so it forwards the person's session cookie and the
// business acted on is the SESSION's, never one the request names. A token that
// let the app say "tenant X" was a token that let anything holding it say so.
//
// Brand-blind: what each brand keeps in its own settings slice, which rail apps
// a setup answer means, and which names it reserves stay in the brand's app.
// This file stores them under the brand's key and reads nothing in them.

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ALL_MODULES, configuredSocialProviders, type ModuleSlug } from '@wizeworks/auth';
import {
  createCheckoutSession,
  createPortalSession,
  heldDiscount,
  offerStanding,
  planFor,
} from '@wizeworks/billing';
import { prisma, SAMPLE_DATA_PACKS } from '@wizeworks/db';
import { capacityReport } from '@wizeworks/usage';

import {
  AddressTakenError,
  addressVerdict,
  mergeBrandSettings,
  recordAcquisitionOnce,
  saveBusinessSetup,
  saveHeardAbout,
} from '../../lib/business-setup.js';
import { furnishTenant } from '../../lib/furnish-tenant.js';
import { capacityWire } from '../v1/usage.js';
import { blueprintSlugsHiddenFrom } from '../../lib/marketplace/brand-scope.js';
import { readConsent, writeConsent } from '../../lib/user-consent.js';
import { AcquisitionBody, platformSession } from './platform-scope.js';

/** Roles that may pay for, set up, or furnish a business. */
const MANAGING_ROLES = new Set(['owner', 'admin']);

/** Names no business may take as its web address, whatever its brand. The
 *  brand's app adds its own; this is the floor. */
const RESERVED_ADDRESSES = new Set([
  'www',
  'api',
  'app',
  'admin',
  'mcp',
  'mail',
  'email',
  'account',
  'accounts',
  'help',
  'support',
  'status',
  'internal',
  'system',
]);

const SLUG = z
  .string()
  .min(2)
  .max(63)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);

const ConsentBody = z.object({ analytics: z.boolean() });
const ReturnBody = z.object({ returnUrl: z.string().url() });
const AddressQuery = z.object({ slug: SLUG });
const SetupBody = z.object({
  name: z.string().trim().min(1).max(120),
  slug: SLUG.nullable(),
  railApps: z.array(z.string().min(1).max(64)).max(64).optional(),
  brandSettings: z.record(z.string(), z.unknown()).optional(),
  /** The brand's own reserved names, added to the floor above. */
  reserved: z.array(z.string().max(63)).max(200).optional(),
});
const BrandSettingsBody = z.record(z.string(), z.unknown());
const HeardAboutBody = z.object({
  answer: z
    .string()
    .max(64)
    .regex(/^[a-z0-9-]+$/),
});
const FurnishBody = z.object({
  industry: z.string().min(1).max(64).nullable(),
  blueprintKey: z.string().min(1).max(120).optional(),
  /** False when the brand charges one flat price, so no per-module billing
   *  items are made. */
  billPerModule: z.boolean().optional(),
});

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function withMarker(returnUrl: string, status: 'success' | 'cancelled'): string {
  const u = new URL(returnUrl);
  u.searchParams.set('billing', status);
  return u.toString();
}

type Session = NonNullable<Awaited<ReturnType<typeof platformSession>>>;

/** The caller's session, or a 401 sent and null returned. With `manage`, a
 *  member who may not manage the business gets a 403 instead. */
async function signedIn(
  request: FastifyRequest,
  reply: FastifyReply,
  opts: { manage?: boolean } = {}
): Promise<Session | null> {
  reply.header('cache-control', 'no-store, private');
  const found = await platformSession(request);
  if (!found) {
    await reply.code(401).send({ error: 'unauthenticated' });
    return null;
  }
  if (opts.manage && !MANAGING_ROLES.has(found.session.user.role)) {
    await reply.code(403).send({ error: 'forbidden' });
    return null;
  }
  return found;
}

async function billingSummary(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { billingPlan: true, stripeSubscriptionId: true, stripeCustomerId: true },
  });
  if (!tenant) return null;
  const plan = planFor(tenant.billingPlan);
  const subscribed = Boolean(tenant.stripeSubscriptionId);
  return {
    subscribed,
    canManage: Boolean(tenant.stripeCustomerId) && subscribed,
    baseMonthlyCents: plan.base?.monthlyCents ?? null,
    discount: await heldDiscount(plan, tenant.stripeSubscriptionId),
    offer: subscribed ? null : await offerStanding(plan),
  };
}

/** The templates this business's brand may see, for the setup picker. Brand
 *  visibility is declared in the bundle manifests, which ship in this image. */
async function blueprintChoices(brand: string) {
  const hidden = await blueprintSlugsHiddenFrom(brand);
  const rows = await prisma.marketplaceBlueprint.findMany({
    where: {
      status: 'published',
      visibility: 'public',
      ...(hidden.length ? { slug: { notIn: hidden } } : {}),
    },
    orderBy: { sortWeight: 'desc' },
    select: {
      slug: true,
      name: true,
      tagline: true,
      description: true,
      vertical: true,
      media: true,
    },
  });
  return rows.map((r) => {
    const media = Array.isArray(r.media) ? (r.media as { url?: string; kind?: string }[]) : [];
    const preview = media.find((m) => m.kind === 'preview') ?? media[0];
    return {
      key: r.slug,
      name: r.name,
      summary: r.tagline ?? r.description ?? '',
      vertical: r.vertical,
      ...(preview?.url ? { preview: preview.url } : {}),
    };
  });
}

const platformBusinessRoutes: FastifyPluginAsync = (app) => {
  // Which sign-in buttons can work. The credentials live in this process, so
  // only this process can say; an app that guessed would draw a dead button.
  app.get('/auth/:brand/platform/sign-in-options', async (_request, reply) => {
    reply.header('cache-control', 'no-store, private');
    return reply.send({ social: configuredSocialProviders() });
  });

  app.get('/auth/:brand/platform/consent', async (request, reply) => {
    const found = await signedIn(request, reply);
    if (!found) return reply;
    const { user } = found.session;
    return reply.send({ consent: await readConsent(user.id, user.homeTenantId) });
  });

  app.post('/auth/:brand/platform/consent', async (request, reply) => {
    const found = await signedIn(request, reply);
    if (!found) return reply;
    const { analytics } = ConsentBody.parse(request.body);
    const { user } = found.session;
    return reply.send({ consent: await writeConsent(user.id, user.homeTenantId, analytics) });
  });

  app.get('/auth/:brand/platform/business', async (request, reply) => {
    const found = await signedIn(request, reply);
    if (!found) return reply;
    const { tenantId } = found.session.user;
    const [tenant, site] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          name: true,
          slug: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          settings: true,
        },
      }),
      prisma.domain.findFirst({
        where: { tenantId, type: 'subdomain' },
        orderBy: [{ isCanonical: 'desc' }, { createdAt: 'asc' }],
        select: { host: true },
      }),
    ]);
    if (!tenant) return reply.code(404).send({ error: 'not_found' });
    const settings = record(tenant.settings);
    return reply.send({
      business: {
        name: tenant.name,
        slug: tenant.slug,
        subscriptionStatus: tenant.subscriptionStatus,
        trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
        siteHost: site?.host ?? null,
        modulesEnabled: Object.entries(record(settings.modules))
          .filter(([, slot]) => record(slot).enabled === true)
          .map(([slug]) => slug),
        brandSettings: record(settings[found.brand]),
      },
    });
  });

  app.get('/auth/:brand/platform/business/capacity', async (request, reply) => {
    const found = await signedIn(request, reply);
    if (!found) return reply;
    const report = await capacityReport(found.session.user.tenantId, found.brand);
    if (report.rejected.length > 0) {
      request.log.warn(
        { brand: found.brand, rejected: report.rejected },
        'capacity allowance has unreadable entries: those meters are unlimited'
      );
    }
    // Byte counts are bigint, and JSON.stringify throws on one: strings.
    return reply.send({ capacity: capacityWire(report) });
  });

  app.get('/auth/:brand/platform/business/billing', async (request, reply) => {
    const found = await signedIn(request, reply);
    if (!found) return reply;
    return reply.send({ billing: await billingSummary(found.session.user.tenantId) });
  });

  app.post('/auth/:brand/platform/business/billing/checkout', async (request, reply) => {
    const found = await signedIn(request, reply, { manage: true });
    if (!found) return reply;
    const { returnUrl } = ReturnBody.parse(request.body);
    return reply.send(
      await createCheckoutSession(found.session.user.tenantId, {
        successUrl: withMarker(returnUrl, 'success'),
        cancelUrl: withMarker(returnUrl, 'cancelled'),
      })
    );
  });

  app.post('/auth/:brand/platform/business/billing/portal', async (request, reply) => {
    const found = await signedIn(request, reply, { manage: true });
    if (!found) return reply;
    const { returnUrl } = ReturnBody.parse(request.body);
    return reply.send({ url: await createPortalSession(found.session.user.tenantId, returnUrl) });
  });

  app.get('/auth/:brand/platform/business/setup-options', async (request, reply) => {
    const found = await signedIn(request, reply);
    if (!found) return reply;
    return reply.send({
      blueprints: await blueprintChoices(found.brand),
      // The trades this platform can furnish sample data for. The app names
      // them in its own words; the label here is the fallback.
      industries: Object.entries(SAMPLE_DATA_PACKS).map(([key, pack]) => ({
        key,
        label: pack.label,
      })),
    });
  });

  app.get('/auth/:brand/platform/business/address', async (request, reply) => {
    const found = await signedIn(request, reply);
    if (!found) return reply;
    const { slug } = AddressQuery.parse(request.query);
    return reply.send({
      verdict: await addressVerdict(prisma, found.session.user.tenantId, slug, RESERVED_ADDRESSES),
    });
  });

  app.post('/auth/:brand/platform/business/setup', async (request, reply) => {
    const found = await signedIn(request, reply, { manage: true });
    if (!found) return reply;
    const body = SetupBody.parse(request.body);
    try {
      await saveBusinessSetup({
        tenantId: found.session.user.tenantId,
        brand: found.brand,
        name: body.name,
        slug: body.slug,
        railApps: body.railApps ? [...new Set(body.railApps)] : undefined,
        brandSettings: body.brandSettings,
        reserved: new Set([...RESERVED_ADDRESSES, ...(body.reserved ?? [])]),
      });
    } catch (err) {
      if (err instanceof AddressTakenError) {
        return reply.code(409).send({ error: 'address_taken', slug: err.slug });
      }
      throw err;
    }
    return reply.send({ ok: true });
  });

  app.post('/auth/:brand/platform/business/brand-settings', async (request, reply) => {
    const found = await signedIn(request, reply, { manage: true });
    if (!found) return reply;
    const values = BrandSettingsBody.parse(request.body);
    await mergeBrandSettings(found.session.user.tenantId, found.brand, values);
    return reply.send({ ok: true });
  });

  app.post('/auth/:brand/platform/business/heard-about', async (request, reply) => {
    const found = await signedIn(request, reply);
    if (!found) return reply;
    const { answer } = HeardAboutBody.parse(request.body);
    await saveHeardAbout(found.session.user.tenantId, answer);
    return reply.send({ ok: true });
  });

  app.post('/auth/:brand/platform/business/acquisition', async (request, reply) => {
    const found = await signedIn(request, reply);
    if (!found) return reply;
    await recordAcquisitionOnce(found.session.user.tenantId, AcquisitionBody.parse(request.body));
    return reply.send({ ok: true });
  });

  // Turns on every module, stamps the template, and loads sample data for the
  // trade. Two minutes is not unusual; the app waits.
  //
  // It has to run in THIS process. `module.activated` rides two buses into two
  // process spaces, and the one that seeds the CRM pipeline, tax, shipping,
  // scheduling and email defaults is in-process here. An app publishing to the
  // broker alone would get the flags and none of the seeding, silently. See
  // lib/furnish-tenant.ts.
  app.post('/auth/:brand/platform/business/furnish', async (request, reply) => {
    const found = await signedIn(request, reply, { manage: true });
    if (!found) return reply;
    const body = FurnishBody.parse(request.body);
    // A trade with no sample pack furnishes as no trade, never as an error:
    // the setup is still worth finishing.
    const industry =
      body.industry && Object.hasOwn(SAMPLE_DATA_PACKS, body.industry) ? body.industry : null;
    const result = await furnishTenant(
      {
        tenantId: found.session.user.tenantId,
        modules: [...ALL_MODULES] as ModuleSlug[],
        industry,
        blueprintKey: body.blueprintKey,
        billPerModule: body.billPerModule,
      },
      request.log
    );
    return reply.code(201).send(result);
  });

  return Promise.resolve();
};

export default platformBusinessRoutes;
