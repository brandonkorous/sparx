// B2B portal — customer-facing service scheduling (docs/64 B2B Ph7).
//
// Customers on the B2B portal can browse service types, book appointments
// for their account, and view/cancel their own bookings.
//
//   GET  /v1/public/b2b/service-types?tenant=   → list active service types
//   POST /v1/public/b2b/portal/:accountId/appointments
//                                               → book an appointment
//   GET  /v1/public/b2b/portal/:accountId/appointments
//                                               → list appointments for account
//   POST /v1/public/b2b/portal/:accountId/appointments/:id/cancel
//                                               → customer cancels their own

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenant } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { unauthorized, forbidden, notFound, badRequest } from '@sparx/api-core/errors';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';
import {
  verifyCustomerSession,
  SESSION_COOKIE_NAME,
  type CustomerAuthContext,
} from '@sparx/customer-auth';
import { resolveTenantId } from '../../../lib/public-commerce-context.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTx = import('@sparx/db').TxClient & Record<string, any>;

const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};
const publisher = createPublisher({
  projectId: process.env.GCP_PROJECT_ID ?? '',
  logger: pubLogger,
});

const PathAccountId = z.object({ accountId: z.string().uuid() });
const PathApptId = z.object({ accountId: z.string().uuid(), id: z.string().uuid() });
const PagedQuery = z.object({
  take: z.coerce.number().int().min(1).max(100).default(20),
  skip: z.coerce.number().int().min(0).default(0),
  status: z.enum(['requested', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional(),
});

const VehicleRefSchema = z.object({
  year: z.number().int().min(1900).max(2100).optional(),
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  vin: z.string().max(17).optional(),
  licensePlate: z.string().max(20).optional(),
  engineProfile: z.string().max(255).optional(),
});

const BookBody = z.object({
  serviceTypeId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  vehicleRef: VehicleRefSchema.optional(),
  notes: z.string().max(2000).optional(),
});

const CancelBody = z.object({ reason: z.string().max(1000).optional() });

async function requirePortalCustomer(request: FastifyRequest, ctx: CustomerAuthContext) {
  const token = request.cookies[SESSION_COOKIE_NAME];
  if (!token) throw unauthorized('Not signed in.');
  const session = await verifyCustomerSession(ctx, token);
  if (!session) throw unauthorized('Session expired. Please sign in again.');
  return session.customerId;
}

async function requireContactRole(ctx: CustomerAuthContext, customerId: string, accountId: string) {
  const contact = await withTenant(ctx, (tx) =>
    tx.b2bAccountContact.findFirst({
      where: { customerId, accountId, isActive: true },
      select: { role: true },
    })
  );
  if (!contact) throw forbidden('You do not have access to this B2B account.');
  return contact.role;
}

const b2bPortalSchedulingRoutes: FastifyPluginAsync = async (app) => {
  // ── List available service types ──────────────────────────────────────────
  app.get('/v1/public/b2b/service-types', async (request) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };

    const types = (await withTenant(ctx, (tx) =>
      (tx as AnyTx).serviceType.findMany({
        where: { tenantId, deletedAt: null, isActive: true },
        select: {
          id: true,
          name: true,
          description: true,
          durationMinutes: true,
          color: true,
          requiresVehicle: true,
          notes: true,
        },
        orderBy: { name: 'asc' },
      })
    )) as {
      id: string;
      name: string;
      description: string | null;
      durationMinutes: number;
      color: string | null;
      requiresVehicle: boolean;
      notes: string | null;
    }[];

    return ok({ types });
  });

  // ── Book an appointment ───────────────────────────────────────────────────
  app.post('/v1/public/b2b/portal/:accountId/appointments', async (request, reply) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requirePortalCustomer(request, ctx);
    const { accountId } = PathAccountId.parse(request.params);
    await requireContactRole(ctx, customerId, accountId);
    const body = BookBody.parse(request.body);

    const appt = await withTenant(ctx, async (tx) => {
      const svcType = await (tx as AnyTx).serviceType.findFirst({
        where: { id: body.serviceTypeId, tenantId, isActive: true, deletedAt: null },
        select: { id: true, durationMinutes: true, name: true },
      });
      if (!svcType) throw notFound('Service type not found');

      return (tx as AnyTx).serviceAppointment.create({
        data: {
          tenantId,
          serviceTypeId: body.serviceTypeId,
          b2bAccountId: accountId,
          customerId,
          scheduledAt: new Date(body.scheduledAt),
          durationMinutes: body.durationMinutes ?? svcType.durationMinutes,
          vehicleRef: body.vehicleRef ?? null,
          notes: body.notes ?? null,
        },
        select: {
          id: true,
          serviceTypeId: true,
          b2bAccountId: true,
          scheduledAt: true,
          durationMinutes: true,
          status: true,
          vehicleRef: true,
          notes: true,
          createdAt: true,
          serviceType: { select: { id: true, name: true } },
        },
      });
    });

    await publishEvent(
      publisher,
      'b2b.appointment.requested',
      tenantId,
      null,
      { appointmentId: appt.id, serviceTypeId: body.serviceTypeId },
      pubLogger
    );

    return reply.status(201).send(
      ok({
        ...appt,
        scheduledAt: appt.scheduledAt.toISOString(),
        createdAt: appt.createdAt.toISOString(),
      })
    );
  });

  // ── List appointments for account ─────────────────────────────────────────
  app.get('/v1/public/b2b/portal/:accountId/appointments', async (request) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requirePortalCustomer(request, ctx);
    const { accountId } = PathAccountId.parse(request.params);
    const role = await requireContactRole(ctx, customerId, accountId);
    const q = PagedQuery.parse(request.query);

    // Viewers only see their own appointments; other roles see all account bookings.
    const where: Record<string, unknown> = {
      tenantId,
      b2bAccountId: accountId,
      ...(role === 'viewer' ? { customerId } : {}),
      ...(q.status ? { status: q.status } : {}),
    };

    const { items, total } = await withTenant(ctx, async (tx) => {
      const [items, total] = await Promise.all([
        (tx as AnyTx).serviceAppointment.findMany({
          where,
          select: {
            id: true,
            serviceTypeId: true,
            scheduledAt: true,
            durationMinutes: true,
            status: true,
            vehicleRef: true,
            notes: true,
            confirmedAt: true,
            completedAt: true,
            cancelledAt: true,
            cancellationReason: true,
            createdAt: true,
            serviceType: { select: { id: true, name: true } },
            customer: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { scheduledAt: 'asc' },
          take: q.take,
          skip: q.skip,
        }),
        (tx as AnyTx).serviceAppointment.count({ where }),
      ]);
      return { items, total };
    });

    type Row = (typeof items)[number];

    return ok(
      paged(
        (items as Row[]).map((a) => ({
          id: a.id,
          serviceTypeId: a.serviceTypeId,
          serviceTypeName: a.serviceType?.name ?? null,
          scheduledAt: a.scheduledAt.toISOString(),
          durationMinutes: a.durationMinutes,
          status: a.status,
          vehicleRef: a.vehicleRef,
          notes: a.notes,
          confirmedAt: a.confirmedAt?.toISOString() ?? null,
          completedAt: a.completedAt?.toISOString() ?? null,
          cancelledAt: a.cancelledAt?.toISOString() ?? null,
          cancellationReason: a.cancellationReason,
          createdAt: a.createdAt.toISOString(),
          customerName: a.customer
            ? [a.customer.firstName, a.customer.lastName].filter(Boolean).join(' ') ||
              a.customer.email
            : null,
        })),
        { total, skip: q.skip, take: q.take }
      )
    );
  });

  // ── Customer cancels their own appointment ────────────────────────────────
  app.post('/v1/public/b2b/portal/:accountId/appointments/:id/cancel', async (request, reply) => {
    const tenantId = await resolveTenantId(request);
    const ctx: CustomerAuthContext = { tenantId };
    const customerId = await requirePortalCustomer(request, ctx);
    const { accountId, id } = PathApptId.parse(request.params);
    await requireContactRole(ctx, customerId, accountId);
    const body = CancelBody.parse(request.body);

    const appt = await withTenant(ctx, async (tx) => {
      const existing = await (tx as AnyTx).serviceAppointment.findFirst({
        where: { id, tenantId, b2bAccountId: accountId, customerId },
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          serviceType: { select: { name: true } },
        },
      });
      if (!existing) throw notFound('Appointment not found');
      if (existing.status === 'completed')
        throw badRequest('Cannot cancel a completed appointment');
      if (existing.status === 'cancelled') throw badRequest('Appointment is already cancelled');

      return (tx as AnyTx).serviceAppointment.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: body.reason ?? null,
        },
        select: { id: true, status: true, cancelledAt: true, cancellationReason: true },
      });
    });

    await publishEvent(
      publisher,
      'b2b.appointment.cancelled',
      tenantId,
      null,
      { appointmentId: id, reason: body.reason ?? null, cancelledByCustomer: true },
      pubLogger
    );

    return reply.send(
      ok({
        ...appt,
        cancelledAt: appt.cancelledAt?.toISOString() ?? null,
      })
    );
  });
};

export default b2bPortalSchedulingRoutes;
