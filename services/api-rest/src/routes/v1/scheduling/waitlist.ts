// Service-level waitlist (docs/79 §5/§7) — staff-side management. Add a customer to
// a service's waitlist, offer them a freed slot (held with a TTL), and accept the
// offer by booking a concrete time in their window. The api-rest waitlist tick
// drives auto-offer + the offer email; these routes are the manual/admin surface.
//
//   GET    /v1/scheduling/waitlist             → list (filter by service / status)
//   POST   /v1/scheduling/waitlist             → add an entry
//   POST   /v1/scheduling/waitlist/:id/offer    → offer a freed slot (TTL)
//   POST   /v1/scheduling/waitlist/:id/accept   → accept → book the slot
//   DELETE /v1/scheduling/waitlist/:id          → remove from the waitlist

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { WaitlistEntry } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import {
  AcceptWaitlistInput,
  CreateWaitlistEntryInput,
  OfferWaitlistInput,
} from '@sparx/scheduling-schemas';
import {
  acceptWaitlistOffer,
  joinWaitlist,
  leaveWaitlist,
  listWaitlistDetailed,
  offerWaitlistEntry,
  type WaitlistEntryDetail,
} from '@sparx/scheduling';

import { requireSchedulingModule, toSchedulingContext } from '../../../lib/scheduling-context.js';
import { publishBookingEvent } from '../../../lib/scheduling-events.js';
import { sendWaitlistOffer } from '../../../lib/scheduling-waitlist.js';

const PathId = z.object({ id: z.string().uuid() });
const ListQuery = z.object({
  serviceId: z.string().uuid().optional(),
  status: z.string().max(20).optional(),
  customerId: z.string().uuid().optional(),
});

function waitlistView(e: WaitlistEntry) {
  return {
    id: e.id,
    serviceId: e.serviceId,
    customerId: e.customerId,
    resourcePref: e.resourcePref,
    desiredFrom: e.desiredFrom.toISOString(),
    desiredTo: e.desiredTo.toISOString(),
    status: e.status,
    offeredAt: e.offeredAt?.toISOString() ?? null,
    offerExpiresAt: e.offerExpiresAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
  };
}

function detailView(e: WaitlistEntryDetail) {
  return {
    ...waitlistView(e),
    serviceName: e.serviceName,
    customerName: e.customerName,
    customerEmail: e.customerEmail,
  };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const schedulingWaitlistRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/scheduling/waitlist', async (request) => {
    await requireSchedulingModule(request);
    const { tenantId } = toSchedulingContext(request);
    const q = ListQuery.parse(request.query);
    const rows = await listWaitlistDetailed(tenantId, q);
    return ok(rows.map(detailView));
  });

  app.post('/v1/scheduling/waitlist', async (request, reply) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const input = CreateWaitlistEntryInput.parse(request.body);
    const entry = await joinWaitlist(tenantId, input);
    return reply.code(201).send(ok(waitlistView(entry)));
  });

  app.post('/v1/scheduling/waitlist/:id/offer', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId, userId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const input = OfferWaitlistInput.parse({ ...(request.body as object), id });
    const entry = await offerWaitlistEntry(tenantId, id, input.offerTtlMinutes);
    await sendWaitlistOffer(request.log, tenantId, id);
    await publishBookingEvent('booking.waitlist_offered', tenantId, userId, {
      waitlistEntryId: id,
      serviceId: entry.serviceId,
      customerId: entry.customerId,
    });
    return ok(waitlistView(entry));
  });

  app.post('/v1/scheduling/waitlist/:id/accept', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId, userId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const input = AcceptWaitlistInput.parse({ ...(request.body as object), id });
    const result = await acceptWaitlistOffer(tenantId, input);
    await publishBookingEvent('booking.created', tenantId, userId, {
      bookingId: result.booking.id,
      serviceId: result.booking.serviceId,
      source: 'waitlist',
    });
    return ok({ entry: waitlistView(result.entry), bookingId: result.booking.id });
  });

  app.delete('/v1/scheduling/waitlist/:id', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const entry = await leaveWaitlist(tenantId, id);
    return ok(waitlistView(entry));
  });
};

export default schedulingWaitlistRoutes;
