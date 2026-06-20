// Public booking surface (docs/79 §13) — the unauthenticated endpoints the
// storefront booking widget calls. Tenant is resolved from `?tenant=<slug>`;
// every route is gated on the `scheduling` module flag. A guest booking
// find-or-creates a CRM customer by email (the shared customer spine) so the
// booking attaches to a real record and confirmations have somewhere to go.
//
//   GET  /v1/public/scheduling/services?tenant=            → bookable services
//   GET  /v1/public/scheduling/availability?tenant=&...    → open slots
//   POST /v1/public/scheduling/bookings?tenant=            → create a booking

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { isModuleEnabled } from '@sparx/auth';
import { withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { badRequest, moduleDisabled, notFound } from '@sparx/api-core/errors';
import { createBooking, getAvailability, getService, listServices } from '@sparx/scheduling';
import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import { publishBookingEvent } from '../../../lib/scheduling-events.js';

async function requireScheduling(request: FastifyRequest): Promise<string> {
  const tenantId = await resolveTenantId(request);
  if (!(await isModuleEnabled(tenantId, 'scheduling'))) throw moduleDisabled('scheduling');
  return tenantId;
}

const AvailabilityQuery = z.object({
  serviceId: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  partySize: z.coerce.number().int().min(1).max(100000).optional(),
});

const CustomerInfo = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().max(50).optional(),
});

const CreatePublicBooking = z.object({
  serviceId: z.string().uuid(),
  startAt: z.string().datetime(),
  partySize: z.coerce.number().int().min(1).max(100000).optional(),
  customer: CustomerInfo,
  notes: z.string().max(2000).optional(),
});

function splitName(name: string): { firstName: string; lastName: string | null } {
  const parts = name.trim().split(/\s+/);
  const firstName = parts.shift() ?? name.trim();
  return { firstName, lastName: parts.length ? parts.join(' ') : null };
}

/** Find a customer by email within the tenant, or create a lightweight record. */
async function findOrCreateCustomer(
  tenantId: string,
  info: z.infer<typeof CustomerInfo>
): Promise<string> {
  const email = info.email.trim().toLowerCase();
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.customer.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
      select: { id: true },
    });
    if (existing) return existing.id;
    const { firstName, lastName } = splitName(info.name);
    const created = await tx.customer.create({
      data: {
        tenantId,
        email,
        firstName,
        lastName,
        phone: info.phone ?? null,
        metadata: { source: 'scheduling' },
      },
      select: { id: true },
    });
    return created.id;
  });
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const publicSchedulingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/public/scheduling/services', async (request) => {
    const tenantId = await requireScheduling(request);
    const services = await listServices(tenantId, { activeOnly: true });
    return ok(
      services
        .filter((s) => s.bookableOnline)
        .map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          bookingType: s.bookingType,
          durationMinutes: s.durationMinutes,
          priceCents: s.priceCents,
          currency: s.currency,
          capacity: s.capacity,
          color: s.color,
          imageUrl: s.imageUrl,
          requiresApproval: s.requiresApproval,
          slotIntervalMin: s.slotIntervalMin,
          minLeadMinutes: s.minLeadMinutes,
          maxAdvanceDays: s.maxAdvanceDays,
        }))
    );
  });

  app.get('/v1/public/scheduling/availability', async (request) => {
    const tenantId = await requireScheduling(request);
    const query = AvailabilityQuery.parse(request.query);
    const service = await getService(tenantId, query.serviceId).catch(() => null);
    if (!service || !service.bookableOnline || !service.isActive) {
      throw notFound('Service', query.serviceId);
    }
    const slots = await getAvailability(tenantId, query, Date.now());
    // Strip candidate resource ids — the public surface only needs times + count.
    return ok(
      slots.map((s) => ({
        startAt: new Date(s.startAtUtc).toISOString(),
        endAt: new Date(s.endAtUtc).toISOString(),
        remaining: Math.min(...Object.values(s.candidatesByRole).map((ids) => ids.length), 1),
      }))
    );
  });

  app.post('/v1/public/scheduling/bookings', async (request, reply) => {
    const tenantId = await requireScheduling(request);
    const body = CreatePublicBooking.parse(request.body);

    const service = await getService(tenantId, body.serviceId).catch(() => null);
    if (!service || !service.bookableOnline || !service.isActive) {
      throw notFound('Service', body.serviceId);
    }
    if (service.bookingType === 'reservation' && !body.partySize) {
      throw badRequest('Party size is required for a reservation.');
    }

    const customerId = await findOrCreateCustomer(tenantId, body.customer);

    const created = await createBooking(tenantId, {
      serviceId: body.serviceId,
      startAt: body.startAt,
      customerId,
      partySize: body.partySize,
      resourceIds: [],
      partsLinked: [],
      attendees: [
        {
          customerId,
          guestName: body.customer.name,
          partySize: body.partySize ?? 1,
        },
      ],
      notes: body.notes ?? null,
      source: 'site',
    });

    await publishBookingEvent('booking.created', tenantId, null, {
      bookingId: created.booking.id,
      serviceId: service.id,
      customerId,
      source: 'site',
    });

    return reply.code(201).send(
      ok({
        id: created.booking.id,
        status: created.booking.status,
        serviceName: service.name,
        startAt: created.booking.startAt.toISOString(),
        endAt: created.booking.endAt.toISOString(),
        requiresApproval: created.booking.status === 'requested',
      })
    );
  });
};

export default publicSchedulingRoutes;
