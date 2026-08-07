// Calling (docs/144 §5.6).
//
//   GET    /v1/crm/calls                  → calls on a record
//   POST   /v1/crm/calls                  → click to call
//   PATCH  /v1/crm/calls/:id              → what was said, and correcting the outcome
//
//   GET/POST/DELETE /v1/crm/voice[/:id]   → the tenant's own phone system
//
// The status callback the provider posts to is PUBLIC and lives separately
// (routes/v1/public/crm-call-status.ts) — the provider has no sparx session, so
// a signed token is the auth.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { callService, voiceConnectionService } from '@sparx/crm';
import { toE164 } from '@sparx/voice';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireAuth, requireRole } from '@sparx/api-core/auth';
import { badRequest } from '@sparx/api-core/errors';

import { requireCrmModule, toCrmContext } from '../../../lib/crm-context.js';
import { resolvePropertyId } from '../../../lib/property.js';
import {
  encryptVoiceSecret,
  isVoiceCryptoConfigured,
  providerFor,
} from '../../../lib/crm-voice.js';

const IdPath = z.object({ id: z.string().uuid() });

const CallQuery = z.object({
  customer_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
});

const PlaceBody = z.object({
  customerId: z.string().uuid(),
  dealId: z.string().uuid().nullable().optional(),
  ticketId: z.string().uuid().nullable().optional(),
  /** The rep's own phone, which rings first. Accepted as typed and normalized
   *  here — a rep should not have to know what E.164 is to make a call. */
  fromDeviceNumber: z.string().min(7).max(32),
});

const callRoutes: FastifyPluginAsync = (app) => {
  /* ── Calls ────────────────────────────────────────────────────────────── */

  app.get('/v1/crm/calls', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const q = CallQuery.parse(request.query);
    const items = await callService.listFor(toCrmContext(request), {
      customerId: q.customer_id,
      dealId: q.deal_id,
      take: q.take,
    });
    return paged(items, { total: items.length, per_page: items.length });
  });

  // Click to call. Returns 201 with the row even when the vendor refused — an
  // attempt that failed is a fact about the day, and losing it would leave
  // somebody unsure whether they had already tried.
  app.post('/v1/crm/calls', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const body = PlaceBody.parse(request.body);

    const device = toE164(body.fromDeviceNumber);
    if (!device) {
      throw badRequest('That does not look like a phone number sparx can ring.');
    }

    const auth = requireAuth(request);
    const ctx = toCrmContext(request);
    const header = request.headers['x-sparx-property-id'];

    // The number is resolved for the CUSTOMER'S site, which the service knows
    // and this route does not — so it hands down a resolver rather than a
    // number. Returning null raises a 422 from the service with the message a
    // person needs; pre-checking here could only ever check the wrong site.
    //
    // A GLOBAL customer (no site of their own) is called from the site the
    // operator is working IN. They belong to every site equally, so the only
    // number that means anything to them is the one for the business the person
    // dialling is currently running.
    const result = await callService.placeCall(
      ctx,
      { ...body, fromDeviceNumber: device },
      {
        resolveOrigin: async (customerPropertyId) => {
          const propertyId =
            customerPropertyId ??
            (await resolvePropertyId(auth, typeof header === 'string' ? header : null));
          const { fromNumber } = await providerFor(ctx.tenantId, propertyId);
          return fromNumber ? { fromNumber, propertyId } : null;
        },
      }
    );
    return reply.code(201).send(ok(result));
  });

  app.patch('/v1/crm/calls/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    return ok(await callService.update(toCrmContext(request), id, request.body));
  });

  /* ── The phone system itself ──────────────────────────────────────────── */

  app.get('/v1/crm/voice', async (request) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const items = await voiceConnectionService.list(toCrmContext(request));
    return paged(items, { total: items.length, per_page: items.length });
  });

  app.post('/v1/crm/voice', async (request, reply) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    if (!isVoiceCryptoConfigured()) {
      throw badRequest('Connecting a phone system is not switched on for this deployment.');
    }
    const body = (request.body ?? {}) as { authToken?: unknown };
    if (typeof body.authToken !== 'string' || body.authToken === '') {
      throw badRequest('The phone system’s auth token is required.');
    }
    const connected = await voiceConnectionService.connect(toCrmContext(request), request.body, {
      authTokenEnc: encryptVoiceSecret(body.authToken),
    });
    return reply.code(201).send(ok(connected));
  });

  app.delete('/v1/crm/voice/:id', async (request) => {
    requireRole(request, 'admin');
    await requireCrmModule(request);
    const { id } = IdPath.parse(request.params);
    await voiceConnectionService.disconnect(toCrmContext(request), id);
    return ok({ disconnected: true });
  });

  return Promise.resolve();
};

export default callRoutes;
