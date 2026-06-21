// Customer self-service booking portal (docs/79 §15 Phase 3c) — the
// authenticated counterpart to the guest booking surface (public/scheduling.ts).
//
//   GET  /v1/public/scheduling/account/bookings        ?tenant=&scope=&page=&pageSize=
//   GET  /v1/public/scheduling/account/bookings/:id     ?tenant=
//   POST /v1/public/scheduling/account/bookings/:id/cancel      ?tenant=  { reason? }
//   POST /v1/public/scheduling/account/bookings/:id/reschedule  ?tenant=  { startAt }
//
// Auth is the same first-party httpOnly cookie (sparx_customer_session) the
// commerce account surface uses; the tenant comes from ?tenant=<slug>. Every
// booking is OWNERSHIP-CHECKED against the signed-in customer (the engine's
// get/cancel/reschedule scope to the tenant, not the customer), so one customer
// can never read or mutate another's booking — a mismatch 404s without leaking
// existence. Gated on the `scheduling` module. Engine errors (slot unavailable,
// invalid state) map via app.ts's schedulingErrorMapper.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { isModuleEnabled } from '@sparx/auth';
import {
  cancelBooking,
  getBooking,
  listBookings,
  rescheduleBooking,
  type BookingWithRelations,
} from '@sparx/scheduling';
import {
  SESSION_COOKIE_NAME,
  verifyCustomerSession,
  type CustomerAuthContext,
} from '@sparx/customer-auth';
import { ok, paged } from '@sparx/api-core/envelope';
import { moduleDisabled, notFound, unauthorized } from '@sparx/api-core/errors';

import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import { publishBookingEvent } from '../../../lib/scheduling-events.js';
import { settleBookingPayment } from '../../../lib/scheduling-payments.js';
import { bookingCalendarLinks } from '../../../lib/scheduling-ical.js';

const ListQuery = z.object({
  scope: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

const IdParam = z.object({ bookingId: z.string().uuid() });
const CancelBody = z.object({ reason: z.string().max(500).optional() });
const RescheduleBody = z.object({ startAt: z.string().datetime() });

/** Resolve the tenant + gate on the scheduling module (the portal is inert when
 *  the tenant hasn't activated Scheduling). */
async function bookingContext(request: FastifyRequest): Promise<CustomerAuthContext> {
  const tenantId = await resolveTenantId(request);
  if (!(await isModuleEnabled(tenantId, 'scheduling'))) throw moduleDisabled('scheduling');
  return { tenantId };
}

/** Read + verify the session cookie → the signed-in customer id, or 401. */
async function requireCustomer(request: FastifyRequest, ctx: CustomerAuthContext): Promise<string> {
  const token = request.cookies[SESSION_COOKIE_NAME];
  if (!token) throw unauthorized('Not signed in.');
  const session = await verifyCustomerSession(ctx, token);
  if (!session) throw unauthorized('Session expired. Please sign in again.');
  return session.customerId;
}

const MODIFIABLE = ['requested', 'confirmed'];

/** A customer-facing projection of a booking — only their-eyes copy (no staff
 *  notes). `canCancel`/`canReschedule` drive the portal's action buttons; the
 *  engine still enforces the real state machine + slot availability on write. */
function toBookingDto(
  b: BookingWithRelations,
  now: number,
  tenantId: string
): Record<string, unknown> {
  const future = b.startAt.getTime() > now;
  const modifiable = MODIFIABLE.includes(b.status) && future;
  return {
    id: b.id,
    serviceName: b.service.name,
    bookingType: b.bookingType,
    status: b.status,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    timezone: b.timezone,
    durationMinutes: b.service.durationMinutes,
    partySize: b.partySize,
    staff: b.resources.filter((r) => r.resource.kind === 'staff').map((r) => r.resource.name),
    notes: b.notes,
    cancellationReason: b.cancellationReason,
    serviceId: b.service.id,
    canCancel: modifiable,
    canReschedule: modifiable,
    // "Add to calendar" — only meaningful for a live (non-cancelled) booking.
    calendar:
      b.status === 'cancelled' || b.status === 'no_show'
        ? null
        : bookingCalendarLinks(tenantId, b.id, {
            summary: b.service.name,
            start: b.startAt,
            end: b.endAt,
          }),
  };
}

/** Load a booking and assert it belongs to this customer (else 404 — never leak
 *  another customer's booking existence). */
async function ownedBooking(
  tenantId: string,
  bookingId: string,
  customerId: string
): Promise<BookingWithRelations> {
  const booking = await getBooking(tenantId, bookingId);
  if (booking.customerId !== customerId) throw notFound('Booking', bookingId);
  return booking;
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync contract; route registration is sync
const schedulingAccountRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/public/scheduling/account/bookings', async (request) => {
    const { scope, page, pageSize } = ListQuery.parse(request.query);
    const ctx = await bookingContext(request);
    const customerId = await requireCustomer(request, ctx);
    const nowIso = new Date().toISOString();
    const { rows, total } = await listBookings(ctx.tenantId, {
      customerId,
      take: pageSize,
      skip: (page - 1) * pageSize,
      ...(scope === 'upcoming' ? { from: nowIso, order: 'asc' } : {}),
      ...(scope === 'past' ? { to: nowIso, order: 'desc' } : {}),
      ...(scope === 'all' ? { order: 'desc' } : {}),
    });
    const now = Date.now();
    return paged(
      rows.map((b) => toBookingDto(b, now, ctx.tenantId)),
      { page, per_page: pageSize, total, total_pages: Math.ceil(total / pageSize) }
    );
  });

  app.get('/v1/public/scheduling/account/bookings/:bookingId', async (request) => {
    const { bookingId } = IdParam.parse(request.params);
    const ctx = await bookingContext(request);
    const customerId = await requireCustomer(request, ctx);
    const booking = await ownedBooking(ctx.tenantId, bookingId, customerId);
    return ok(toBookingDto(booking, Date.now(), ctx.tenantId));
  });

  app.post('/v1/public/scheduling/account/bookings/:bookingId/cancel', async (request) => {
    const { bookingId } = IdParam.parse(request.params);
    const body = CancelBody.parse(request.body ?? {});
    const ctx = await bookingContext(request);
    const customerId = await requireCustomer(request, ctx);
    // Ownership first — a 404 here means "not yours", indistinguishable from
    // "doesn't exist". The engine then enforces the cancellable-state machine.
    await ownedBooking(ctx.tenantId, bookingId, customerId);
    const updated = await cancelBooking(ctx.tenantId, {
      id: bookingId,
      reason: body.reason ?? 'Cancelled by customer',
      // Self-service cancel: the policy fee applies (a late cancel captures it from
      // the hold; an on-time cancel releases/refunds it) — settleBookingPayment
      // decides, so the customer can't waive it on their own behalf.
      waiveFee: false,
      notifyCustomer: true,
    });
    // Settle the deposit/hold per policy (timely → release/refund; late → fee).
    await settleBookingPayment(request.log, ctx.tenantId, bookingId, 'cancel');
    await publishBookingEvent('booking.cancelled', ctx.tenantId, null, {
      bookingId,
      customerId,
      source: 'portal',
    });
    return ok(toBookingDto(await getBooking(ctx.tenantId, updated.id), Date.now(), ctx.tenantId));
  });

  app.post('/v1/public/scheduling/account/bookings/:bookingId/reschedule', async (request) => {
    const { bookingId } = IdParam.parse(request.params);
    const body = RescheduleBody.parse(request.body);
    const ctx = await bookingContext(request);
    const customerId = await requireCustomer(request, ctx);
    await ownedBooking(ctx.tenantId, bookingId, customerId);
    // resourceIds empty → keep the same resources at the new time; the engine's
    // EXCLUDE constraint re-checks availability and throws SlotUnavailable (→409).
    const updated = await rescheduleBooking(ctx.tenantId, {
      id: bookingId,
      startAt: body.startAt,
      resourceIds: [],
      notifyCustomer: true,
    });
    await publishBookingEvent('booking.rescheduled', ctx.tenantId, null, {
      bookingId,
      customerId,
      startAt: body.startAt,
      source: 'portal',
    });
    return ok(toBookingDto(await getBooking(ctx.tenantId, updated.id), Date.now(), ctx.tenantId));
  });
};

export default schedulingAccountRoutes;
