// The customer's own booking, reached WITHOUT an account (issue 153).
//
//   GET  /v1/public/scheduling/manage?t=…
//   POST /v1/public/scheduling/manage/cancel?t=…      { reason? }
//   POST /v1/public/scheduling/manage/reschedule?t=…  { startAt }
//
// Somebody who books a haircut has no account and was never asked to make one.
// Sending her to a sign-in wall to move it is the same as telling her to phone —
// which is the thing self-service exists to replace. So the "Change or cancel"
// link in her confirmation carries a signed token scoped to ONE booking, and the
// token is the auth: it went to the address she typed into the booking form and
// nowhere else, which is the trust model of the one-click unsubscribe link and
// of every manage-your-booking link in the trade.
//
// The token names the booking, so no id, tenant or email is taken from the
// caller — a tampered token fails its HMAC and 404s, and a valid token can only
// ever reach the one booking it was minted for. Everything past that (whose it
// is, whether it can still be moved, whether the salon is open then) is decided
// by the same code the signed-in portal runs: lib/scheduling-customer-view.ts.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { isModuleEnabled } from '@wizeworks/auth';
import { getBooking, type BookingWithRelations } from '@wizeworks/scheduling';
import { ok } from '@wizeworks/api-core/envelope';
import { notFound } from '@wizeworks/api-core/errors';

import { readSchedulingToken } from '../../../lib/scheduling-token.js';
import {
  cancelForCustomer,
  rescheduleForCustomer,
  toCustomerBookingDto,
} from '../../../lib/scheduling-customer-view.js';

const TokenQuery = z.object({ t: z.string().min(1).max(2048) });
const CancelBody = z.object({ reason: z.string().max(500).optional() });
const RescheduleBody = z.object({ startAt: z.string().datetime() });

interface Opened {
  tenantId: string;
  booking: BookingWithRelations;
}

/**
 * Verify the link and load the one booking it names.
 *
 * Every failure is the same 404 — a bad signature, a token for a tenant that has
 * since switched Scheduling off, a booking that was deleted. A link that stopped
 * working must not explain WHY in a way that tells a stranger which bookings
 * exist.
 */
async function open(request: FastifyRequest): Promise<Opened> {
  const { t } = TokenQuery.parse(request.query);
  const decoded = readSchedulingToken(t, 'm');
  if (!decoded) throw notFound('Booking', 'link');
  if (!(await isModuleEnabled(decoded.tenantId, 'scheduling'))) throw notFound('Booking', 'link');
  const booking = await getBooking(decoded.tenantId, decoded.id).catch(() => null);
  if (!booking) throw notFound('Booking', 'link');
  return { tenantId: decoded.tenantId, booking };
}

/** A booking that is over, called off or already walked in is READ-ONLY here,
 *  whatever the link says. The DTO's `canCancel`/`canReschedule` say the same
 *  thing to the page, but the page is not what enforces it. */
function requireStillOpen(booking: BookingWithRelations): void {
  const open = booking.status === 'requested' || booking.status === 'confirmed';
  if (!open || booking.startAt.getTime() <= Date.now()) throw notFound('Booking', booking.id);
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync contract; route registration is sync
const schedulingManageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/public/scheduling/manage', async (request) => {
    const { tenantId, booking } = await open(request);
    return ok(await toCustomerBookingDto(booking, Date.now(), tenantId));
  });

  app.post('/v1/public/scheduling/manage/cancel', async (request) => {
    const body = CancelBody.parse(request.body ?? {});
    const { tenantId, booking } = await open(request);
    requireStillOpen(booking);
    return ok(
      await cancelForCustomer(
        request.log,
        tenantId,
        booking.id,
        booking.customerId,
        'manage-link',
        body.reason
      )
    );
  });

  app.post('/v1/public/scheduling/manage/reschedule', async (request) => {
    const body = RescheduleBody.parse(request.body);
    const { tenantId, booking } = await open(request);
    requireStillOpen(booking);
    return ok(
      await rescheduleForCustomer(
        tenantId,
        booking.id,
        booking.customerId,
        body.startAt,
        'manage-link'
      )
    );
  });
};

export default schedulingManageRoutes;
