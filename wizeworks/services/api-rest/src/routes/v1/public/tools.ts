// "Email this to me" for the free-tool pages (docs/152 A3).
//
//   POST /v1/public/tools/deliver ?tenant=<slug>[&property=<slug>]
//
// Each marketing site publishes the same set of free tools: an invoice builder, a
// margin calculator, a QR code maker, a link tagger, a favicon generator. Someone
// who finishes one has told us what kind of business they run through an ACTION
// rather than a form, and until now they used it and left. This is the one step
// that turns that into a conversation: send them the thing they just made, and
// record the opt-in.
//
// BRAND IS RESOLVED, NEVER PASSED
//
// The sign-off name and the link back come from `platformBrandIdentity`, keyed by
// the tenant's own `platformBrand` — the resolution path shared code is required
// to use when it has no request host to read. There is deliberately no brand
// parameter and no per-brand table here: a lookup keyed by brand is a brand
// conditional wearing a nicer hat, and it is the thing that has to be edited the
// day a third brand launches.
//
// TWO EFFECTS, DELIBERATELY INDEPENDENT
//
//  1. SEND the result. Always. The visitor asked for it, so a module flag must
//     never silently swallow it.
//  2. RECORD the lead, best-effort, gated on CRM like every other capture. If
//     CRM is off there is no contact spine to write to, and that is a reason to
//     skip the record — never a reason to withhold the email they asked for.
//
// WHY THIS ENDPOINT IS NOT AN OPEN MAIL RELAY
//
// It is unauthenticated and it sends mail to an address in the request body,
// which is the shape of a spam relay, so the abuse surface is closed by
// construction rather than by hoping:
//
//  · The SUBJECT and the LINK never come from the request. The client sends a
//    tool SLUG; the name comes from the server-side table below and the link
//    from the resolved brand identity. An attacker cannot make the email say
//    something of their choosing in the place a recipient actually reads before
//    opening.
//  · The body is a fixed template rendered by React Email, so values are escaped
//    and no markup survives.
//  · `lines` is capped in count and length by the delivery gate's schema.
//  · Per-IP rate limiting, at the same ceiling the storefront auth routes use.
//
// WHAT THE EMAIL MAY CARRY
//
// Only values the tool COMPUTED. Never a file the visitor supplied and never
// bytes derived from one. Several tool pages promise, in their own marketing
// copy, that the tool runs entirely in the browser and nothing is uploaded — the
// favicon generator says so in its meta description. That promise is about the
// visitor's own file, and it stays true only because this endpoint has no way to
// accept one: the body takes label/value text, and so does the template.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { isModuleEnabled } from '@wizeworks/auth';
import { platformBrandIdentity } from '@wizeworks/brand-core';
import { customerService } from '@wizeworks/crm';
import { prisma, withTenant } from '@wizeworks/db';
import { ok } from '@wizeworks/api-core/envelope';
import { publish } from '@wizeworks/api-core/pubsub';
import { notFound, validationError } from '@wizeworks/api-core/errors';

// Same ceiling the storefront auth routes use — generous for a person, useless
// for a sender.
const DELIVER_RATE_LIMIT = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

/**
 * The tools this endpoint will send a result for, and what to CALL them.
 *
 * The display name lives here rather than in the request because it becomes the
 * subject line. A free-text subject on an unauthenticated send-to-anyone route
 * is the whole abuse case; a slug that has to match this table is not.
 *
 * It duplicates the `slug` and `name` of each marketing site's own tool registry,
 * and that duplication is deliberate: those apps are separate applications that
 * must each be deletable without touching the other, so this service cannot
 * import either one's registry. The drift risk is a slug renamed on a site and
 * not here, whose symptom is a loud 400 on that one tool rather than anything
 * silent.
 *
 * The tool set itself is brand-blind — every brand ships the same tools — so this
 * table is not a brand conditional; it is the shared vocabulary both use.
 */
const TOOL_NAMES: Record<string, string> = {
  barcode: 'Barcode generator',
  'color-palette': 'Color palette generator',
  'contrast-checker': 'Contrast checker',
  'digital-card': 'Digital business card',
  'domain-checker': 'Domain checker',
  'email-deliverability': 'Email deliverability checker',
  'email-signature': 'Email signature generator',
  favicon: 'Favicon generator',
  invoice: 'Invoice generator',
  'margin-calculator': 'Margin calculator',
  'meta-tags': 'Meta tag generator',
  'og-image': 'Open Graph image generator',
  'privacy-policy': 'Privacy policy generator',
  'qr-code': 'QR code generator',
  quote: 'Quote builder',
  'structured-data': 'Structured data generator',
  'utm-builder': 'UTM link builder',
};

const Query = z.object({
  tenant: z.string().min(1).max(63),
  property: z.string().min(1).max(63).optional(),
});

const Body = z.object({
  email: z.string().email().max(255),
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  /** Must be a key of TOOL_NAMES — the name and URL are derived, never sent. */
  toolSlug: z.string().min(1).max(63),
  /** The COMPUTED output. Bounds mirror the delivery gate so an oversized body
   *  is refused here with a clear 400 instead of being dropped by the worker. */
  lines: z
    .array(z.object({ label: z.string().min(1).max(120), value: z.string().max(4000) }))
    .min(1)
    .max(50),
  note: z.string().max(2000).optional(),
});

function clientIp(request: FastifyRequest): string | undefined {
  return request.ip || undefined;
}

const publicToolsRoutes: FastifyPluginAsync = (app) => {
  app.post('/v1/public/tools/deliver', DELIVER_RATE_LIMIT, async (request) => {
    const q = Query.parse(request.query);
    const body = Body.parse(request.body);

    const toolName = TOOL_NAMES[body.toolSlug];
    if (!toolName)
      throw validationError('Unknown tool.', [{ field: 'toolSlug', message: 'Unknown tool.' }]);

    const tenant = await prisma.tenant.findUnique({
      where: { slug: q.tenant },
      select: { id: true, platformBrand: true },
    });
    if (!tenant) throw notFound('Tenant', q.tenant);

    // Brand from the tenant, never from the request (see the header note).
    // `siteUrl` is env-derived and can legitimately be unset, in which case the
    // email simply carries no link back rather than an invented one — the
    // results are what the visitor asked for, and they still arrive.
    const identity = platformBrandIdentity(tenant.platformBrand);
    const toolUrl = identity.siteUrl ? `${identity.siteUrl}/tools/${body.toolSlug}` : undefined;

    // ── 1. Send it. This is what the visitor actually asked for. ──────────────
    // publish() never throws (a Pub/Sub hiccup is logged, not surfaced), which is
    // the right trade here: a mail glitch must not turn into a red error on a
    // marketing page for someone who just wanted their invoice.
    await publish(request.log, 'email.send', tenant.id, null, {
      template: 'tool-result',
      to: body.email,
      props: {
        toolName,
        ...(toolUrl ? { toolUrl } : {}),
        lines: body.lines,
        note: body.note ?? null,
        brandName: identity.name,
      },
    });

    // ── 2. Record the lead, best-effort. ─────────────────────────────────────
    // Gated on CRM because the contact spine is a CRM concern. Unlike
    // /v1/public/newsletter this does NOT 404 when CRM is off: that route exists
    // only to join a list, so refusing is the honest answer there. Here the list
    // is the secondary effect and the email is the primary one.
    if (await isModuleEnabled(tenant.id, 'crm')) {
      // Scope the contact to a site so it shows under one in the console rather
      // than floating at the tenant level (same reasoning as the newsletter
      // route). `properties` is FORCE RLS, so resolve inside withTenant.
      const property = await withTenant({ tenantId: tenant.id }, (tx) =>
        q.property
          ? tx.property.findFirst({
              where: { tenantId: tenant.id, slug: q.property },
              select: { id: true },
            })
          : tx.property.findFirst({
              where: { tenantId: tenant.id, isPrimary: true },
              select: { id: true },
            })
      );

      await customerService.subscribe(
        { tenantId: tenant.id },
        {
          email: body.email,
          firstName: body.firstName ?? null,
          lastName: body.lastName ?? null,
          propertyId: property?.id ?? null,
          source: 'signup',
          // One list for every tool, with the specific tool in the note. A list
          // per tool would fragment seventeen ways and make "people who used a
          // free tool" — the segment anyone actually wants — unbuildable.
          list: 'tools',
          note: `Used the ${toolName}`,
          ipAddress: clientIp(request),
        }
      );
    }

    // Never reveal whether the address was already on file — a capture form must
    // not double as an email oracle (same contract as newsletter/signup).
    return ok({ ok: true });
  });

  return Promise.resolve();
};

export default publicToolsRoutes;
