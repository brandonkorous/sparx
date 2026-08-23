// Customer self-service booking portal (docs/79 §15 Phase 3c) — the SIGNED-IN
// counterpart to the guest booking surface (public/scheduling.ts) and to the
// signed-link manage page (public/scheduling-manage.ts).
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
//
// What a customer may SEE and DO lives in lib/scheduling-customer-view.ts,
// shared with the manage-link routes so the two doors cannot drift apart.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { isModuleEnabled } from '@wizeworks/auth';
import { getBooking, listBookings, type BookingWithRelations } from '@wizeworks/scheduling';
import { type CustomerAuthContext } from '@wizeworks/customer-auth';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { moduleDisabled, notFound } from '@wizeworks/api-core/errors';

import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import { requireCustomerId } from '../../../lib/customer-session.js';
import {
  cancelForCustomer,
  rescheduleForCustomer,
  toCustomerBookingDto,
} from '../../../lib/scheduling-customer-view.js';

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

/** The signed-in customer id for the active site, or 401 (docs/27 v2 — session →
 *  Better Auth user → per-site membership, resolved in lib/customer-session).
 *  `scope` gates a customer MCP OAuth bearer (docs/113 §5); a cookie session always
 *  passes. */
function requireCustomer(
  request: FastifyRequest,
  ctx: CustomerAuthContext,
  scope: string
): Promise<string> {
  return requireCustomerId(request, ctx, scope);
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
    const customerId = await requireCustomer(request, ctx, 'bookings:read');
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
    return paged(await Promise.all(rows.map((b) => toCustomerBookingDto(b, now, ctx.tenantId))), {
      page,
      per_page: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    });
  });

  app.get('/v1/public/scheduling/account/bookings/:bookingId', async (request) => {
    const { bookingId } = IdParam.parse(request.params);
    const ctx = await bookingContext(request);
    const customerId = await requireCustomer(request, ctx, 'bookings:read');
    const booking = await ownedBooking(ctx.tenantId, bookingId, customerId);
    return ok(await toCustomerBookingDto(booking, Date.now(), ctx.tenantId));
  });

  app.post('/v1/public/scheduling/account/bookings/:bookingId/cancel', async (request) => {
    const { bookingId } = IdParam.parse(request.params);
    const body = CancelBody.parse(request.body ?? {});
    const ctx = await bookingContext(request);
    const customerId = await requireCustomer(request, ctx, 'bookings:write');
    // Ownership first — a 404 here means "not yours", indistinguishable from
    // "doesn't exist". The engine then enforces the cancellable-state machine.
    await ownedBooking(ctx.tenantId, bookingId, customerId);
    return ok(
      await cancelForCustomer(
        request.log,
        ctx.tenantId,
        bookingId,
        customerId,
        'portal',
        body.reason
      )
    );
  });

  app.post('/v1/public/scheduling/account/bookings/:bookingId/reschedule', async (request) => {
    const { bookingId } = IdParam.parse(request.params);
    const body = RescheduleBody.parse(request.body);
    const ctx = await bookingContext(request);
    const customerId = await requireCustomer(request, ctx, 'bookings:write');
    await ownedBooking(ctx.tenantId, bookingId, customerId);
    return ok(
      await rescheduleForCustomer(ctx.tenantId, bookingId, customerId, body.startAt, 'portal')
    );
  });
};

export default schedulingAccountRoutes;
