// B2B customer portal: booking service for the account's vehicles, and each
// vehicle's service history (sparx persona issue 086).
//
//   GET  /v1/public/b2b/portal/:accountId/service?tenant=&property=
//        → { enabled, canBook, services, vehicles, records, myOrderIds }
//          `enabled` is false (and nothing else is sent) when the business has
//          not turned scheduling on, so the portal shows no booking entry at all.
//   POST /v1/public/b2b/portal/:accountId/service/bookings?tenant=&property=
//        → book a service for one of THIS account's vehicles
//
// The /b2b page promises a fleet account "books service from the same portal:
// service types, durations, and capacity, tied to the account, with confirmations
// and reminders", and that service history "records against the vehicle in the
// fleet profile". The booking made here is an ordinary booking written through
// `createBooking`, the same call the public booking widget makes, so it gets the
// same confirmation and reminder emails (the engine lays them down in the booking's
// own transaction for the person it is for: here, the signed-in contact), the same
// owner notice, and the same `booking.created` event. What this route adds is the
// account (`companyId`) and the vehicle (`assetRef`, the fleet vehicle's stable id
// plus a snapshot), which is what files the visit under that vehicle's history.
//
// Guarded like the rest of the portal (b2b-portal.ts): a signed-in customer with
// an ACTIVE contact role on THIS account. The vehicle is looked up inside this
// account's own fleet, and history is read by this account's id, so a contact
// cannot see or book against another account's vehicles. Booking takes a buyer
// or the primary contact, the same roles that may submit a quote; an approver or
// a viewer reads the history only.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { isModuleEnabled } from '@wizeworks/auth';
import { withTenant } from '@wizeworks/db';
import { findFleetVehicle, getAccountFleet } from '@wizeworks/b2b';
import { vehicleLabel } from '@wizeworks/commerce-schemas';
import {
  createBooking,
  customerFacingPlace,
  findBookingPlace,
  findServicePlaces,
  getAvailability,
  getService,
  listServices,
} from '@wizeworks/scheduling';
import { ok } from '@wizeworks/api-core/envelope';
import { conflict, forbidden, moduleDisabled, notFound } from '@wizeworks/api-core/errors';
import type { CustomerAuthContext } from '@wizeworks/customer-auth';
import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import { resolvePublicPropertyId } from '../../../lib/property.js';
import { requireCustomerId } from '../../../lib/customer-session.js';
import { publishBookingEvent } from '../../../lib/scheduling-events.js';
import { createBookingDeposit } from '../../../lib/scheduling-payments.js';
import { bookingCalendarLinks } from '../../../lib/scheduling-ical.js';
import { bookingManagePath } from '../../../lib/scheduling-token.js';
import { sendOwnerBookingNotification } from '../../../lib/scheduling-owner-notify.js';
import {
  SERVICE_RECORD_SELECT,
  toServiceRecord,
  vehicleSnapshot,
} from '../../../lib/fleet-service-records.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** The history a portal page shows: the newest visits, enough for years of a
 *  small fleet, bounded so a large one cannot ask for everything at once. */
const HISTORY_LIMIT = 200;

/** Contact roles allowed to book (the same two that may submit a quote). */
const BOOKER_ROLES = new Set(['primary_contact', 'buyer']);

const PathAccountId = z.object({ accountId: z.string().uuid() });

const BookServiceBody = z.object({
  // A fleet vehicle id: stable for the life of the vehicle. Not validated as a
  // uuid because an older vehicle's id is derived on read rather than minted.
  vehicleId: z.string().trim().min(1).max(100),
  serviceId: z.string().uuid(),
  startAt: z.string().datetime(),
  notes: z.string().trim().max(2000).optional(),
});

/** 403 unless the customer has an active role on THIS account; the role. */
async function requireContactRole(
  ctx: CustomerAuthContext,
  customerId: string,
  accountId: string
): Promise<string> {
  const contact = await withTenant(ctx, (tx) =>
    tx.b2bAccountContact.findFirst({
      where: { customerId, accountId, isActive: true },
      select: { role: true },
    })
  );
  if (!contact) throw forbidden('You do not have access to this B2B account.');
  return contact.role;
}

function propertyParam(request: FastifyRequest): string | undefined {
  return (request.query as { property?: string }).property;
}

/** Services a fleet contact may book: the ones the business offers online, of the
 *  kind you book a time for (a class seat or a table is not a vehicle service),
 *  on the site the portal is on. */
async function bookableServices(tenantId: string, propertyId: string) {
  const services = (await listServices(tenantId, { activeOnly: true, propertyId })).filter(
    (s) => s.bookableOnline && s.bookingType === 'appointment'
  );
  const places = await findServicePlaces(
    tenantId,
    services.map((s) => s.id)
  );
  return services
    .map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMinutes: s.durationMinutes,
      priceCents: s.priceCents,
      currency: s.currency,
      requiresApproval: s.requiresApproval,
      requiresAsset: s.requiresAsset,
      minLeadMinutes: s.minLeadMinutes,
      maxAdvanceDays: s.maxAdvanceDays,
      // The clock the times are read in: the place's, not the reader's (issue 109).
      timezone: places.get(s.id)?.timezone ?? null,
    }))
    .sort((a, b) =>
      // Vehicle services first: they are why this page exists.
      a.requiresAsset === b.requiresAsset ? a.name.localeCompare(b.name) : a.requiresAsset ? -1 : 1
    );
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const b2bPortalServiceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/public/b2b/portal/:accountId/service', async (request) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requireCustomerId(request, ctx, 'b2b:read');
    const { accountId } = PathAccountId.parse(request.params);
    const role = await requireContactRole(ctx, customerId, accountId);

    if (!(await isModuleEnabled(tenantId, 'scheduling'))) return ok({ enabled: false });

    const propertyId = await resolvePublicPropertyId(tenantId, propertyParam(request));
    const [services, fleet, rows] = await Promise.all([
      bookableServices(tenantId, propertyId),
      getAccountFleet(ctx, accountId),
      withTenant(ctx, (tx) =>
        tx.booking.findMany({
          // THIS account's visits only: the id the contact role was checked on.
          where: { companyId: accountId, deletedAt: null },
          select: SERVICE_RECORD_SELECT,
          orderBy: { startAt: 'desc' },
          take: HISTORY_LIMIT,
        })
      ),
    ]);
    const records = rows.map((row) => toServiceRecord(row, { staff: false }));

    // Which linked orders are the reader's own: those open on their own order page;
    // a colleague's order is listed on the account's orders page instead.
    const orderIds = [
      ...new Set(records.flatMap((r) => r.parts.map((p) => p.orderId)).filter(Boolean)),
    ] as string[];
    const mine =
      orderIds.length > 0
        ? await withTenant(ctx, (tx) =>
            tx.order.findMany({
              where: { id: { in: orderIds }, customerId },
              select: { id: true },
            })
          )
        : [];

    return ok({
      enabled: true,
      canBook: BOOKER_ROLES.has(role),
      services,
      vehicles: fleet.map((v) => ({ id: v.id, label: vehicleLabel(v), vin: v.vin })),
      records,
      myOrderIds: mine.map((o) => o.id),
    });
  });

  app.post('/v1/public/b2b/portal/:accountId/service/bookings', async (request, reply) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requireCustomerId(request, ctx, 'bookings:write');
    const { accountId } = PathAccountId.parse(request.params);
    const role = await requireContactRole(ctx, customerId, accountId);
    if (!BOOKER_ROLES.has(role)) {
      throw forbidden('Your role on this account cannot book service. Ask a buyer to book it.');
    }
    if (!(await isModuleEnabled(tenantId, 'scheduling'))) throw moduleDisabled('scheduling');
    const body = BookServiceBody.parse(request.body);

    // Looked up in THIS account's fleet, so another account's vehicle id finds
    // nothing rather than a truck that is not theirs.
    const vehicle = await findFleetVehicle(ctx, accountId, body.vehicleId);
    if (!vehicle) throw notFound('Vehicle', body.vehicleId);

    const service = await getService(tenantId, body.serviceId).catch(() => null);
    if (
      !service ||
      !service.bookableOnline ||
      !service.isActive ||
      service.bookingType !== 'appointment'
    ) {
      throw notFound('Service', body.serviceId);
    }

    // Is the time actually offered? The same check, and the same computation, the
    // public booking widget makes before it writes (issue 106).
    const startAt = new Date(body.startAt);
    const openSlots = await getAvailability(
      tenantId,
      {
        serviceId: body.serviceId,
        from: new Date(startAt.getTime() - DAY_MS).toISOString(),
        to: new Date(startAt.getTime() + DAY_MS).toISOString(),
      },
      Date.now()
    );
    if (!openSlots.some((slot) => slot.startAtUtc === startAt.getTime())) {
      throw conflict('That time is no longer available');
    }

    const snapshot = vehicleSnapshot(vehicle);
    const created = await createBooking(tenantId, {
      serviceId: body.serviceId,
      startAt: body.startAt,
      // The contact who booked: the confirmation and reminders go to them.
      customerId,
      companyId: accountId,
      assetRef: { ...snapshot },
      resourceIds: [],
      partsLinked: [],
      attendees: [{ customerId, partySize: 1 }],
      notes: body.notes?.length ? body.notes : null,
      source: 'portal',
    });
    const bookingId = created.booking.id;

    // Deposit / card hold per the service's policy, never fatal: the booking is
    // already in the diary (issue 105).
    const deposit = await createBookingDeposit(request.log, tenantId, bookingId).catch(
      (err: unknown) => {
        request.log.error(
          { err, tenantId, bookingId },
          'scheduling: deposit failed after a portal booking was created, confirming without one'
        );
        return { required: false } as const;
      }
    );

    await publishBookingEvent('booking.created', tenantId, null, {
      bookingId,
      serviceId: service.id,
      customerId,
      companyId: accountId,
      source: 'portal',
    });
    // Tell the business a fleet account booked (docs/79 §10).
    await sendOwnerBookingNotification(request.log, tenantId, bookingId);

    const place = await findBookingPlace(tenantId, {
      locationId: created.booking.locationId,
      serviceId: service.id,
    });
    const calendar = bookingCalendarLinks(tenantId, bookingId, {
      summary: `${service.name}: ${snapshot.label}`,
      start: created.booking.startAt,
      end: created.booking.endAt,
      ...(place ? { location: place.line } : {}),
    });

    return reply.code(201).send(
      ok({
        id: bookingId,
        status: created.booking.status,
        serviceName: service.name,
        vehicle: snapshot.label,
        startAt: created.booking.startAt.toISOString(),
        endAt: created.booking.endAt.toISOString(),
        timezone: created.booking.timezone,
        requiresApproval: created.booking.status === 'requested',
        location: customerFacingPlace(place),
        deposit: deposit.required
          ? {
              clientSecret: deposit.clientSecret,
              ...(deposit.publishableKey ? { publishableKey: deposit.publishableKey } : {}),
              amountCents: deposit.amountCents,
              type: deposit.type,
            }
          : null,
        calendar,
        manageUrl: bookingManagePath(tenantId, bookingId),
      })
    );
  });
};

export default b2bPortalServiceRoutes;
