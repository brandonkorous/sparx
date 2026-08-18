// Internal tenant-furnishing hook — the second half of onboarding, called by
// whichever app runs the signup flow once it has a real tenant and a real owner.
//
// Auth: shared secret in `X-sparx-Internal-Furnish-Token`, constant-time
// compared against env.SPARX_INTERNAL_FURNISH_TOKEN. A SEPARATE secret from the
// cron / acquisition / partners / operator tokens on purpose — this one WRITES
// heavily into a named tenant (module flags, config presets, a site template and
// hundreds of sample rows), which is a different blast radius from triggering a
// scheduler or reading a report, so it rotates independently.
//
// ── WHY AN INTERNAL ENDPOINT AND NOT THE v1 ROUTES ──────────────────────────
//
// The three layers each already have a v1 route, and a console CAN call them
// with the operator's own session. An onboarding app cannot: it holds a Better
// Auth session, not an api-rest bearer token, and minting one there would put a
// second token-issuing surface on the auth authority for the sake of three
// calls. This is service-to-service by a shared secret, which is what the rest
// of /internal already is — not a user credential, and not a second way to mint
// one.
//
// It is also the only place the work can be CORRECT. `module.activated` rides
// two buses reaching two process spaces, and the one that seeds the CRM
// pipeline, tax, shipping, scheduling and email defaults is IN-PROCESS here. An
// app publishing to the broker alone gets the flags and none of the seeding —
// silently. See lib/furnish-tenant.ts.
//
//   • GET  /internal/tenant/blueprints?tenantId=…  → the templates that tenant's
//     BRAND may see, for the signup app's picker. It lives here rather than in the
//     signup app because brand visibility is declared in the bundle manifests,
//     which ship in this image and not that one.
//   • POST /internal/tenant/furnish   → { tenantId, modules, industry, … }
//
// The `tenants` table is deliberately non-RLS (the dispatch row), so the tenant
// is addressed by id with the plain system client; everything the furnishing
// itself writes goes through `withTenant` and stays RLS-scoped.

import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ALL_MODULES, type ModuleSlug } from '@wizeworks/auth';
import { prisma } from '@wizeworks/db';

import { env } from '../../env.js';
import { furnishTenant } from '../../lib/furnish-tenant.js';
import { blueprintSlugsHiddenFrom } from '../../lib/marketplace/brand-scope.js';
import { tenantPlatformBrand } from '../../lib/tenant-brand.js';

const FURNISH_TOKEN_HEADER = 'x-sparx-internal-furnish-token';

const MODULE_SET = new Set<string>(ALL_MODULES);

const bodySchema = z.object({
  tenantId: z.string().uuid(),
  /** Modules to switch on. Omit for every module — the flat-plan case, where
   *  there is nothing to choose and withholding one would be a locked door. */
  modules: z.array(z.string()).optional(),
  /** The trade: both the starter slug and the sample-pack key. */
  industry: z.string().min(1).nullable().optional(),
  blueprintKey: z.string().min(1).optional(),
  sampleData: z.boolean().optional(),
  /** False when the caller's plan is FLAT, so no per-module billing items are
   *  synced. Defaults true, which is the per-module model. */
  billPerModule: z.boolean().optional(),
});

function authorize(request: FastifyRequest): void {
  const expected = env.SPARX_INTERNAL_FURNISH_TOKEN;
  if (!expected) {
    // No token configured → endpoint disabled. 401 rather than a silent success,
    // so a forgotten secret in prod shows up as signups arriving unfurnished
    // WITH an error, instead of arriving unfurnished quietly.
    throw unauthorized('Internal furnish token is not configured.');
  }
  const provided = request.headers[FURNISH_TOKEN_HEADER];
  if (typeof provided !== 'string' || provided.length === 0) {
    throw unauthorized('Missing X-sparx-Internal-Furnish-Token header.');
  }
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw unauthorized('Invalid furnish token.');
  }
}

const listQuerySchema = z.object({ tenantId: z.string().uuid() });

const furnishTenantRoutes: FastifyPluginAsync = async (app) => {
  // The templates a tenant may choose from, for the signup app's picker.
  //
  // The onboarding app CANNOT compute this itself, which is the whole reason the
  // endpoint exists. Brand visibility is declared in the bundle manifests, and
  // those ship in THIS image — the account app has the database but not the
  // catalog, so a direct query there would happily hand a Piggles business the
  // other brand's showcase.
  app.get('/internal/tenant/blueprints', async (request) => {
    authorize(request);
    const { tenantId } = listQuerySchema.parse(request.query);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw notFound(`Tenant ${tenantId} does not exist.`);

    const hidden = await blueprintSlugsHiddenFrom(await tenantPlatformBrand(tenantId));
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

    return {
      success: true,
      data: {
        blueprints: rows.map((r) => {
          const media = Array.isArray(r.media)
            ? (r.media as { url?: string; kind?: string }[])
            : [];
          const preview = media.find((m) => m.kind === 'preview') ?? media[0];
          return {
            key: r.slug,
            name: r.name,
            summary: r.tagline ?? r.description ?? '',
            vertical: r.vertical,
            ...(preview?.url ? { preview: preview.url } : {}),
          };
        }),
      },
    };
  });

  app.post('/internal/tenant/furnish', async (request, reply) => {
    authorize(request);
    const body = bodySchema.parse(request.body);

    // The tenant must already exist — this furnishes, it never creates. A 404
    // here means the caller onboarded against a tenant that is gone, which is a
    // bug worth seeing rather than a fresh tenant appearing from a typo'd id.
    const tenant = await prisma.tenant.findUnique({
      where: { id: body.tenantId },
      select: { id: true },
    });
    if (!tenant) throw notFound(`Tenant ${body.tenantId} does not exist.`);

    // Unknown slugs are dropped rather than rejected: the module catalogue is
    // the platform's and moves, and a caller naming one that has since been
    // renamed should still get a furnished tenant, not a 400 in the middle of
    // somebody's signup.
    const requested = body.modules ?? [...ALL_MODULES];
    const modules = requested.filter((m): m is ModuleSlug => MODULE_SET.has(m));
    const dropped = requested.filter((m) => !MODULE_SET.has(m));
    if (dropped.length > 0) {
      request.log.warn(
        { tenantId: body.tenantId, dropped },
        'furnish: unknown module slugs ignored'
      );
    }

    const result = await furnishTenant(
      {
        tenantId: body.tenantId,
        modules,
        industry: body.industry ?? null,
        blueprintKey: body.blueprintKey,
        sampleData: body.sampleData,
        billPerModule: body.billPerModule,
      },
      request.log
    );

    reply.code(201);
    return { success: true, data: result };
  });

  return Promise.resolve();
};

function unauthorized(message: string): Error {
  const err = new Error(message);
  (err as { statusCode?: number }).statusCode = 401;
  (err as { code?: string }).code = 'UNAUTHORIZED';
  return err;
}

function notFound(message: string): Error {
  const err = new Error(message);
  (err as { statusCode?: number }).statusCode = 404;
  (err as { code?: string }).code = 'NOT_FOUND';
  return err;
}

export default furnishTenantRoutes;
