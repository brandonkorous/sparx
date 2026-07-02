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
import {
  bookClassSeat,
  createBooking,
  getAvailability,
  getService,
  joinWaitlist,
  listBookableResourcesForService,
  listClassSessions,
  listServices,
} from '@sparx/scheduling';
import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import { publishBookingEvent } from '../../../lib/scheduling-events.js';
import { createBookingDeposit } from '../../../lib/scheduling-payments.js';
import { bookingCalendarLinks } from '../../../lib/scheduling-ical.js';
import { sendSeatConfirmation } from '../../../lib/scheduling-classes.js';

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
  // Narrow slots to one customer-chosen resource (a "customer_choice" service, §7.5).
  resourceId: z.string().uuid().optional(),
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
  // The customer's chosen resource for a "customer_choice" service (§7.5). Validated
  // server-side against the service's eligible set before it's honored.
  resourceId: z.string().uuid().optional(),
});

const CreatePublicWaitlist = z.object({
  serviceId: z.string().uuid(),
  customer: CustomerInfo,
  desiredFrom: z.string().datetime(),
  desiredTo: z.string().datetime(),
});

const SessionsQuery = z.object({
  serviceId: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
});

const JoinSession = z.object({
  customer: CustomerInfo,
  partySize: z.coerce.number().int().min(1).max(100000).optional(),
});

/** The customer-facing label for "who" — the first resource requirement's role
 *  ("stylist", "technician"), else a neutral default. Drives the picker heading. */
function providerLabel(resourceRequirements: unknown): string {
  if (Array.isArray(resourceRequirements)) {
    for (const r of resourceRequirements) {
      const role = r && typeof r === 'object' ? (r as { role?: unknown }).role : null;
      if (typeof role === 'string' && role.trim()) return role.trim();
    }
  }
  return 'team member';
}

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
          // Whether the customer picks a specific person, + the word for them.
          assignmentStrategy: s.assignmentStrategy,
          providerLabel: providerLabel(s.resourceRequirements),
        }))
    );
  });

  // The specific resources a customer can pick for a "customer_choice" service
  // (§7.5) — used by the widget's provider step. Public-safe subset only.
  app.get('/v1/public/scheduling/services/:id/resources', async (request) => {
    const tenantId = await requireScheduling(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const service = await getService(tenantId, id).catch(() => null);
    if (!service || !service.bookableOnline || !service.isActive) throw notFound('Service', id);
    if (service.assignmentStrategy !== 'customer_choice') return ok([]);
    return ok(await listBookableResourcesForService(tenantId, id));
  });

  app.get('/v1/public/scheduling/availability', async (request) => {
    const tenantId = await requireScheduling(request);
    const query = AvailabilityQuery.parse(request.query);
    const service = await getService(tenantId, query.serviceId).catch(() => null);
    if (!service || !service.bookableOnline || !service.isActive) {
      throw notFound('Service', query.serviceId);
    }
    // A chosen resource must be one the service actually offers online (guards a
    // forged/offline id); an ineligible pick yields no slots rather than an error.
    if (query.resourceId) {
      const eligible = await listBookableResourcesForService(tenantId, query.serviceId);
      if (!eligible.some((r) => r.id === query.resourceId)) return ok([]);
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

    // A customer-chosen resource is honored only when it's genuinely eligible for
    // the service (online-bookable + matches a requirement) — otherwise ignored, so
    // a tampered id can't book an offline/foreign resource. Empty → engine assigns.
    let resourceIds: string[] = [];
    if (body.resourceId) {
      const eligible = await listBookableResourcesForService(tenantId, body.serviceId);
      if (!eligible.some((r) => r.id === body.resourceId)) {
        throw badRequest('That option is no longer available — please pick another.');
      }
      resourceIds = [body.resourceId];
    }

    const customerId = await findOrCreateCustomer(tenantId, body.customer);

    const created = await createBooking(tenantId, {
      serviceId: body.serviceId,
      startAt: body.startAt,
      customerId,
      partySize: body.partySize,
      resourceIds,
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

    // Deposit / card-hold per the service's policy (docs/79 §9). Returns a
    // clientSecret the widget confirms with the gateway's card element; no policy
    // (or none) → `required:false` and the booking stands as-is.
    const deposit = await createBookingDeposit(request.log, tenantId, created.booking.id);

    await publishBookingEvent('booking.created', tenantId, null, {
      bookingId: created.booking.id,
      serviceId: service.id,
      customerId,
      source: 'site',
    });

    // "Add to calendar" links (docs/79 §8.1) — the per-booking `.ics` download plus
    // Google/Outlook web deep links, shown on the confirmation step.
    const calendar = bookingCalendarLinks(tenantId, created.booking.id, {
      summary: service.name,
      start: created.booking.startAt,
      end: created.booking.endAt,
    });

    return reply.code(201).send(
      ok({
        id: created.booking.id,
        status: created.booking.status,
        serviceName: service.name,
        startAt: created.booking.startAt.toISOString(),
        endAt: created.booking.endAt.toISOString(),
        requiresApproval: created.booking.status === 'requested',
        deposit: deposit.required
          ? {
              clientSecret: deposit.clientSecret,
              amountCents: deposit.amountCents,
              type: deposit.type,
            }
          : null,
        calendar,
      })
    );
  });

  // Join the waitlist when nothing's open in the desired window (docs/79 §7). The
  // tick auto-offers a freed slot to the oldest waiting customer + emails them.
  app.post('/v1/public/scheduling/waitlist', async (request, reply) => {
    const tenantId = await requireScheduling(request);
    const body = CreatePublicWaitlist.parse(request.body);
    const service = await getService(tenantId, body.serviceId).catch(() => null);
    if (!service || !service.bookableOnline || !service.isActive) {
      throw notFound('Service', body.serviceId);
    }
    const customerId = await findOrCreateCustomer(tenantId, body.customer);
    const entry = await joinWaitlist(tenantId, {
      serviceId: body.serviceId,
      customerId,
      desiredFrom: body.desiredFrom,
      desiredTo: body.desiredTo,
    });
    return reply.code(201).send(ok({ id: entry.id, status: entry.status }));
  });

  // Class sessions a customer can join — open seats in a date range (docs/79 §7.2).
  app.get('/v1/public/scheduling/sessions', async (request) => {
    const tenantId = await requireScheduling(request);
    const q = SessionsQuery.parse(request.query);
    const service = await getService(tenantId, q.serviceId).catch(() => null);
    if (!service || !service.bookableOnline || !service.isActive) {
      throw notFound('Service', q.serviceId);
    }
    const sessions = await listClassSessions(tenantId, { ...q, openOnly: true });
    return ok(
      sessions.map((s) => ({
        bookingId: s.bookingId,
        serviceName: s.serviceName,
        startAt: s.startAt.toISOString(),
        endAt: s.endAt.toISOString(),
        remaining: s.remaining,
      }))
    );
  });

  // Join a class session — adds a seat (find-or-creates the customer). A full
  // session enrolls the customer as waitlisted.
  app.post('/v1/public/scheduling/sessions/:id/join', async (request, reply) => {
    const tenantId = await requireScheduling(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = JoinSession.parse(request.body);
    const customerId = await findOrCreateCustomer(tenantId, body.customer);
    const seat = await bookClassSeat(tenantId, {
      bookingId: id,
      customerId,
      guestName: body.customer.name,
      partySize: body.partySize ?? 1,
    });
    if (!seat.waitlisted) {
      await sendSeatConfirmation(request.log, tenantId, id, seat.attendee);
    }
    return reply.code(201).send(
      ok({
        attendeeId: seat.attendee.id,
        status: seat.attendee.status,
        waitlisted: seat.waitlisted,
      })
    );
  });
};

export default publicSchedulingRoutes;
