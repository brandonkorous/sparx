// What people are paid — rates and commissions (docs/149 §2, §5 Person).
//
//   GET    /v1/staff/members/:id/rates   → the rate history
//   POST   /v1/staff/members/:id/rates   → open a new rate window (a raise)
//   DELETE /v1/staff/rates/:id           → a rate typed in wrong
//   GET    /v1/staff/commissions
//   POST   /v1/staff/commissions         → idempotent on (person, sale)
//   POST   /v1/staff/commissions/status  → approve / pay / void, in bulk
//   DELETE /v1/staff/commissions/:id
//
// EVERY route in this file is `admin` (staff-context.ts explains why pay is the
// one place the viewer/editor ladder is wrong). It is the whole reason these are
// a separate file rather than more endpoints on the person: the gate is visible
// in one place instead of being a per-route judgement call somebody eventually
// forgets to make.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@sparx/api-core/envelope';
import { badRequest } from '@sparx/api-core/errors';
import {
  commissionCents,
  deleteCommission,
  deleteRate,
  getMember,
  listCommissions,
  listRates,
  recordCommission,
  setCommissionStatus,
  setRate,
} from '@sparx/staff';
import { commissionSchema, commissionStatusSchema, payRateSchema } from '@sparx/staff/schemas';
import { requirePayAccess, requireStaffModule } from '../../../lib/staff-context.js';
import { displayName, payRateView } from './views.js';

const PathId = z.object({ id: z.string().uuid() });

const CommissionQuery = z.object({
  staffMemberId: z.string().uuid().optional(),
  status: commissionStatusSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const CommissionStatusBody = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  status: commissionStatusSchema,
});

/** `amountCents` may be omitted when a percentage is given — the arithmetic is
 *  the service's `commissionCents`, not the client's, so 8.25% of $1,247.50
 *  rounds the same way whoever asks. Sending both is allowed and the explicit
 *  figure wins: a negotiated one-off is a real thing. */
const CommissionBody = commissionSchema
  .omit({ amountCents: true })
  .extend({ amountCents: z.number().int().min(0).optional() })
  .refine((v) => v.amountCents !== undefined || v.ratePercent != null, {
    message: 'Give either an amount or a rate percentage.',
    path: ['amountCents'],
  });

function commissionView(row: {
  id: string;
  staffMemberId: string;
  propertyId: string | null;
  sourceType: string;
  sourceId: string;
  sourceLabel: string | null;
  basisCents: number;
  ratePercent: { toString(): string } | null;
  amountCents: number;
  currency: string;
  earnedOn: Date;
  status: string;
  paidAt: Date | null;
  note: string | null;
  staffMember?: { firstName: string; lastName: string | null };
}) {
  return {
    id: row.id,
    staffMemberId: row.staffMemberId,
    staffMemberName: row.staffMember ? displayName(row.staffMember) : null,
    propertyId: row.propertyId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    sourceLabel: row.sourceLabel,
    basisCents: row.basisCents,
    // Null is "this was a flat amount nobody derived from a percentage", which
    // is different from 0% and must not render as it.
    ratePercent: row.ratePercent === null ? null : Number(row.ratePercent.toString()),
    amountCents: row.amountCents,
    currency: row.currency,
    earnedOn: row.earnedOn,
    status: row.status,
    paidAt: row.paidAt,
    note: row.note,
  };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const staffPayRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/staff/members/:id/rates', async (request) => {
    await requireStaffModule(request);
    const auth = requirePayAccess(request);
    const { id } = PathId.parse(request.params);
    await getMember(auth.tenantId, id);
    const rates = await listRates(auth.tenantId, id);
    return ok({ items: rates.map(payRateView) });
  });

  // A raise is a NEW window, not an edit. `setRate` closes the previous
  // open-ended rate the day before this one starts, so every cost computed
  // before today still explains itself with the rate that produced it. An
  // overlap that is not that case raises STAFF_PAY_RATE_OVERLAP → 409.
  app.post('/v1/staff/members/:id/rates', async (request, reply) => {
    await requireStaffModule(request);
    const auth = requirePayAccess(request);
    const { id } = PathId.parse(request.params);
    const input = payRateSchema.parse(request.body);
    const rate = await setRate(auth.tenantId, id, input);
    return reply.code(201).send(ok(payRateView(rate)));
  });

  app.delete('/v1/staff/rates/:id', async (request, reply) => {
    await requireStaffModule(request);
    const auth = requirePayAccess(request);
    const { id } = PathId.parse(request.params);
    await deleteRate(auth.tenantId, id);
    return reply.code(204).send();
  });

  app.get('/v1/staff/commissions', async (request) => {
    await requireStaffModule(request);
    const auth = requirePayAccess(request);
    const query = CommissionQuery.parse(request.query);
    const rows = await listCommissions(auth.tenantId, query);
    return ok({
      items: rows.map(commissionView),
      totalCents: rows.reduce((sum, row) => sum + row.amountCents, 0),
    });
  });

  app.post('/v1/staff/commissions', async (request, reply) => {
    await requireStaffModule(request);
    const auth = requirePayAccess(request);
    const input = CommissionBody.parse(request.body);
    const amountCents =
      input.amountCents ?? commissionCents(input.basisCents, input.ratePercent ?? 0);
    const row = await recordCommission(auth.tenantId, { ...input, amountCents });
    return reply.code(201).send(ok(commissionView(row)));
  });

  app.post('/v1/staff/commissions/status', async (request) => {
    await requireStaffModule(request);
    const auth = requirePayAccess(request);
    const body = CommissionStatusBody.parse(request.body);
    const updated = await setCommissionStatus(auth.tenantId, body.ids, body.status, new Date());
    // A count of zero means every id missed — a stale list, or another tenant's
    // ids. Saying so beats a cheerful 200 that changed nothing.
    if (updated === 0) throw badRequest('None of those commissions could be found.');
    return ok({ updated });
  });

  app.delete('/v1/staff/commissions/:id', async (request, reply) => {
    await requireStaffModule(request);
    const auth = requirePayAccess(request);
    const { id } = PathId.parse(request.params);
    await deleteCommission(auth.tenantId, id);
    return reply.code(204).send();
  });
};

export default staffPayRoutes;
