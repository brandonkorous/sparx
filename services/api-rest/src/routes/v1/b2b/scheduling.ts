// B2B service scheduling — types + appointments (docs/64 B2B Ph7).
//
// Service types define what the tenant offers (oil change, inspection, etc.).
// Appointments link a booked slot to a B2B account, an optional fleet vehicle
// snapshot (vehicleRef), and a list of parts expected for the job.
//
// Email events are published on confirm/cancel/complete so the email-worker
// sends confirmation, reminder, and cancellation messages.
//
//   GET    /v1/b2b/service-types              → list active service types
//   POST   /v1/b2b/service-types              → create type
//   PATCH  /v1/b2b/service-types/:id          → update
//   DELETE /v1/b2b/service-types/:id          → soft-delete
//
//   GET    /v1/b2b/appointments               → list (filter: status, account_id, from, to)
//   POST   /v1/b2b/appointments               → create/book
//   GET    /v1/b2b/appointments/:id           → fetch one
//   PATCH  /v1/b2b/appointments/:id           → update (notes, staffNotes, parts, scheduledAt)
//   POST   /v1/b2b/appointments/:id/confirm   → confirm + publish email event
//   POST   /v1/b2b/appointments/:id/complete  → mark complete
//   POST   /v1/b2b/appointments/:id/cancel    → cancel + publish email event

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withTenant } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound, badRequest } from '@sparx/api-core/errors';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';
import { requireB2bModule, toB2bContext } from '../../../lib/b2b-context.js';
import { env } from '../../../env.js';

const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};
const publisher = createPublisher({ projectId: env.GCP_PROJECT_ID, logger: pubLogger });

const PathId = z.object({ id: z.string().uuid() });

// ── Service-type bodies ───────────────────────────────────────────────────────

const ServiceTypeBody = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  isActive: z.boolean().optional(),
  requiresVehicle: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

const ServiceTypePatchBody = ServiceTypeBody.partial();

// ── Appointment bodies ────────────────────────────────────────────────────────

const VehicleRefSchema = z.object({
  year: z.number().int().min(1900).max(2100).optional(),
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  vin: z.string().max(17).optional(),
  licensePlate: z.string().max(20).optional(),
  engineProfile: z.string().max(255).optional(),
});

const PartLinkSchema = z.object({
  productId: z.string().uuid().optional(),
  sku: z.string().max(100).optional(),
  description: z.string().max(255),
  quantity: z.number().int().min(1).default(1),
});

const AppointmentBody = z.object({
  serviceTypeId: z.string().uuid(),
  b2bAccountId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  vehicleRef: VehicleRefSchema.optional(),
  partsLinked: z.array(PartLinkSchema).optional(),
  notes: z.string().max(2000).optional(),
  staffNotes: z.string().max(2000).optional(),
});

const AppointmentPatchBody = z.object({
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  vehicleRef: VehicleRefSchema.optional().nullable(),
  partsLinked: z.array(PartLinkSchema).optional(),
  notes: z.string().max(2000).optional(),
  staffNotes: z.string().max(2000).optional(),
});

const ConfirmBody = z.object({ notes: z.string().max(1000).optional() });
const CancelBody = z.object({ reason: z.string().max(1000).optional() });

const ListAppointmentsQuery = z.object({
  status: z.enum(['requested', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional(),
  account_id: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

// ── View helpers ──────────────────────────────────────────────────────────────

function toTypeView(t: {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  color: string | null;
  isActive: boolean;
  requiresVehicle: boolean;
  notes: string | null;
  createdAt: Date;
}) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    durationMinutes: t.durationMinutes,
    color: t.color,
    isActive: t.isActive,
    requiresVehicle: t.requiresVehicle,
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
  };
}

function toApptView(a: {
  id: string;
  serviceTypeId: string;
  b2bAccountId: string | null;
  customerId: string | null;
  scheduledAt: Date;
  durationMinutes: number;
  status: string;
  vehicleRef: unknown;
  partsLinked: unknown;
  notes: string | null;
  staffNotes: string | null;
  confirmedByUserId: string | null;
  confirmedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  reminderSentAt: Date | null;
  createdAt: Date;
  serviceType?: { id: string; name: string } | null;
  b2bAccount?: { id: string; companyName: string } | null;
  customer?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  confirmedBy?: { id: string; name: string | null } | null;
}) {
  return {
    id: a.id,
    serviceTypeId: a.serviceTypeId,
    serviceTypeName: a.serviceType?.name ?? null,
    b2bAccountId: a.b2bAccountId,
    companyName: a.b2bAccount?.companyName ?? null,
    customerId: a.customerId,
    customerName: a.customer
      ? [a.customer.firstName, a.customer.lastName].filter(Boolean).join(' ') ||
        (a.customer.email ?? null)
      : null,
    customerEmail: a.customer?.email ?? null,
    scheduledAt: a.scheduledAt.toISOString(),
    durationMinutes: a.durationMinutes,
    status: a.status,
    vehicleRef: a.vehicleRef,
    partsLinked: a.partsLinked,
    notes: a.notes,
    staffNotes: a.staffNotes,
    confirmedByUserId: a.confirmedByUserId,
    confirmedByName: a.confirmedBy?.name ?? null,
    confirmedAt: a.confirmedAt?.toISOString() ?? null,
    completedAt: a.completedAt?.toISOString() ?? null,
    cancelledAt: a.cancelledAt?.toISOString() ?? null,
    cancellationReason: a.cancellationReason,
    reminderSentAt: a.reminderSentAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

const APPT_INCLUDE = {
  serviceType: { select: { id: true, name: true } },
  b2bAccount: { select: { id: true, companyName: true } },
  customer: { select: { id: true, firstName: true, lastName: true, email: true } },
  confirmedBy: { select: { id: true, name: true } },
} as const;

// ── Routes ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const b2bSchedulingRoutes: FastifyPluginAsync = async (app) => {
  // ══ Service types ══════════════════════════════════════════════════════════

  app.get('/v1/b2b/service-types', async (request) => {
    await requireB2bModule(request);
    requireRole(request, 'viewer');
    const ctx = toB2bContext(request);

    const types = await withTenant(ctx, (tx) =>
      tx.serviceType.findMany({
        where: { tenantId: ctx.tenantId, deletedAt: null },
        orderBy: { name: 'asc' },
      })
    );

    return ok({ types: types.map(toTypeView) });
  });

  app.post('/v1/b2b/service-types', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'admin');
    const ctx = toB2bContext(request);
    const body = ServiceTypeBody.parse(request.body);

    const type = await withTenant(ctx, (tx) =>
      tx.serviceType.create({
        data: {
          tenantId: ctx.tenantId,
          name: body.name,
          description: body.description ?? null,
          durationMinutes: body.durationMinutes ?? 60,
          color: body.color ?? null,
          isActive: body.isActive ?? true,
          requiresVehicle: body.requiresVehicle ?? false,
          notes: body.notes ?? null,
        },
      })
    );

    return reply.status(201).send(ok(toTypeView(type)));
  });

  app.patch('/v1/b2b/service-types/:id', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'admin');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const body = ServiceTypePatchBody.parse(request.body);

    const type = await withTenant(ctx, async (tx) => {
      const existing = await tx.serviceType.findFirst({
        where: { id, tenantId: ctx.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!existing) throw notFound('Service type not found');

      return tx.serviceType.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.durationMinutes !== undefined ? { durationMinutes: body.durationMinutes } : {}),
          ...(body.color !== undefined ? { color: body.color } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.requiresVehicle !== undefined ? { requiresVehicle: body.requiresVehicle } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        },
      });
    });

    return reply.send(ok(toTypeView(type)));
  });

  app.delete('/v1/b2b/service-types/:id', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'admin');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);

    await withTenant(ctx, async (tx) => {
      const existing = await tx.serviceType.findFirst({
        where: { id, tenantId: ctx.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!existing) throw notFound('Service type not found');
      await tx.serviceType.update({ where: { id }, data: { deletedAt: new Date() } });
    });

    return reply.status(204).send();
  });

  // ══ Appointments ═══════════════════════════════════════════════════════════

  app.get('/v1/b2b/appointments', async (request) => {
    await requireB2bModule(request);
    requireRole(request, 'viewer');
    const ctx = toB2bContext(request);
    const q = ListAppointmentsQuery.parse(request.query);

    const where: Prisma.ServiceAppointmentWhereInput = { tenantId: ctx.tenantId };
    if (q.status) where.status = q.status;
    if (q.account_id) where.b2bAccountId = q.account_id;
    if (q.from || q.to) {
      where.scheduledAt = {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lte: new Date(q.to) } : {}),
      };
    }

    const { items, total } = await withTenant(ctx, async (tx) => {
      const [items, total] = await Promise.all([
        tx.serviceAppointment.findMany({
          where,
          include: APPT_INCLUDE,
          orderBy: { scheduledAt: 'asc' },
          take: q.take,
          skip: q.skip,
        }),
        tx.serviceAppointment.count({ where }),
      ]);
      return { items, total };
    });

    return ok(paged(items.map(toApptView), { total, skip: q.skip, take: q.take }));
  });

  app.post('/v1/b2b/appointments', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const body = AppointmentBody.parse(request.body);

    const appt = await withTenant(ctx, async (tx) => {
      const svcType = await tx.serviceType.findFirst({
        where: { id: body.serviceTypeId, tenantId: ctx.tenantId, deletedAt: null, isActive: true },
        select: { id: true, durationMinutes: true },
      });
      if (!svcType) throw notFound('Service type not found or inactive');

      return tx.serviceAppointment.create({
        data: {
          tenantId: ctx.tenantId,
          serviceTypeId: body.serviceTypeId,
          b2bAccountId: body.b2bAccountId ?? null,
          customerId: body.customerId ?? null,
          scheduledAt: new Date(body.scheduledAt),
          durationMinutes: body.durationMinutes ?? svcType.durationMinutes,
          vehicleRef: body.vehicleRef !== undefined
            ? (body.vehicleRef as Prisma.InputJsonValue)
            : Prisma.DbNull,
          partsLinked: (body.partsLinked ?? []) as Prisma.InputJsonValue,
          notes: body.notes ?? null,
          staffNotes: body.staffNotes ?? null,
        },
        include: APPT_INCLUDE,
      });
    });

    await publishEvent(
      publisher,
      'b2b.appointment.requested',
      ctx.tenantId,
      ctx.userId ?? null,
      { appointmentId: appt.id, serviceTypeId: body.serviceTypeId },
      pubLogger
    );

    return reply.status(201).send(ok(toApptView(appt)));
  });

  app.get('/v1/b2b/appointments/:id', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'viewer');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);

    const appt = await withTenant(ctx, (tx) =>
      tx.serviceAppointment.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: APPT_INCLUDE,
      })
    );

    if (!appt) throw notFound('Appointment not found');
    return reply.send(ok(toApptView(appt)));
  });

  app.patch('/v1/b2b/appointments/:id', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const body = AppointmentPatchBody.parse(request.body);

    const appt = await withTenant(ctx, async (tx) => {
      const existing = await tx.serviceAppointment.findFirst({
        where: { id, tenantId: ctx.tenantId },
        select: { id: true, status: true },
      });
      if (!existing) throw notFound('Appointment not found');
      if (existing.status === 'completed' || existing.status === 'cancelled') {
        throw badRequest(`Cannot edit a ${existing.status} appointment`);
      }

      return tx.serviceAppointment.update({
        where: { id },
        data: {
          ...(body.scheduledAt !== undefined ? { scheduledAt: new Date(body.scheduledAt) } : {}),
          ...(body.durationMinutes !== undefined ? { durationMinutes: body.durationMinutes } : {}),
          ...(body.vehicleRef !== undefined
            ? {
                vehicleRef:
                  body.vehicleRef !== null
                    ? (body.vehicleRef as Prisma.InputJsonValue)
                    : Prisma.DbNull,
              }
            : {}),
          ...(body.partsLinked !== undefined
            ? { partsLinked: body.partsLinked as Prisma.InputJsonValue }
            : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          ...(body.staffNotes !== undefined ? { staffNotes: body.staffNotes } : {}),
        },
        include: APPT_INCLUDE,
      });
    });

    return reply.send(ok(toApptView(appt)));
  });

  app.post('/v1/b2b/appointments/:id/confirm', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const body = ConfirmBody.parse(request.body);

    const { apptView, customerEmail, serviceTypeName } = await withTenant(ctx, async (tx) => {
      const existing = await tx.serviceAppointment.findFirst({
        where: { id, tenantId: ctx.tenantId },
        select: { id: true, status: true },
      });
      if (!existing) throw notFound('Appointment not found');
      if (existing.status !== 'requested') {
        throw badRequest(`Appointment is already ${existing.status}`);
      }

      const updated = await tx.serviceAppointment.update({
        where: { id },
        data: {
          status: 'confirmed',
          confirmedByUserId: ctx.userId ?? null,
          confirmedAt: new Date(),
          ...(body.notes !== undefined ? { staffNotes: body.notes } : {}),
        },
        include: APPT_INCLUDE,
      });

      return {
        apptView: toApptView(updated),
        customerEmail: updated.customer?.email ?? null,
        serviceTypeName: updated.serviceType?.name ?? '',
      };
    });

    await publishEvent(
      publisher,
      'b2b.appointment.confirmed',
      ctx.tenantId,
      ctx.userId ?? null,
      { appointmentId: id },
      pubLogger
    );

    // Publish confirmation email via Pub/Sub → email-worker.
    if (customerEmail) {
      await publishEvent(
        publisher,
        'email.send',
        ctx.tenantId,
        ctx.userId ?? null,
        {
          to: customerEmail,
          template: 'appointment-confirmation',
          props: {
            customerName: apptView.customerName ?? customerEmail,
            serviceTypeName,
            scheduledAt: apptView.scheduledAt,
            durationMinutes: apptView.durationMinutes,
            vehicleDescription: apptView.vehicleRef
              ? buildVehicleDescription(apptView.vehicleRef as Record<string, unknown>)
              : undefined,
          },
        },
        pubLogger
      );
    }

    return reply.send(ok(apptView));
  });

  app.post('/v1/b2b/appointments/:id/complete', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);

    const appt = await withTenant(ctx, async (tx) => {
      const existing = await tx.serviceAppointment.findFirst({
        where: { id, tenantId: ctx.tenantId },
        select: { id: true, status: true },
      });
      if (!existing) throw notFound('Appointment not found');
      if (existing.status === 'completed') throw badRequest('Appointment is already completed');
      if (existing.status === 'cancelled')
        throw badRequest('Cannot complete a cancelled appointment');

      return tx.serviceAppointment.update({
        where: { id },
        data: { status: 'completed', completedAt: new Date() },
        include: APPT_INCLUDE,
      });
    });

    await publishEvent(
      publisher,
      'b2b.appointment.completed',
      ctx.tenantId,
      ctx.userId ?? null,
      { appointmentId: id },
      pubLogger
    );

    return reply.send(ok(toApptView(appt)));
  });

  app.post('/v1/b2b/appointments/:id/cancel', async (request, reply) => {
    await requireB2bModule(request);
    requireRole(request, 'editor');
    const ctx = toB2bContext(request);
    const { id } = PathId.parse(request.params);
    const body = CancelBody.parse(request.body);

    const { apptView, customerEmail, serviceTypeName } = await withTenant(ctx, async (tx) => {
      const existing = await tx.serviceAppointment.findFirst({
        where: { id, tenantId: ctx.tenantId },
        select: { id: true, status: true },
      });
      if (!existing) throw notFound('Appointment not found');
      if (existing.status === 'completed')
        throw badRequest('Cannot cancel a completed appointment');
      if (existing.status === 'cancelled') throw badRequest('Appointment is already cancelled');

      const updated = await tx.serviceAppointment.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: body.reason ?? null,
        },
        include: APPT_INCLUDE,
      });

      return {
        apptView: toApptView(updated),
        customerEmail: updated.customer?.email ?? null,
        serviceTypeName: updated.serviceType?.name ?? '',
      };
    });

    await publishEvent(
      publisher,
      'b2b.appointment.cancelled',
      ctx.tenantId,
      ctx.userId ?? null,
      { appointmentId: id, reason: body.reason ?? null },
      pubLogger
    );

    if (customerEmail) {
      await publishEvent(
        publisher,
        'email.send',
        ctx.tenantId,
        ctx.userId ?? null,
        {
          to: customerEmail,
          template: 'appointment-cancelled',
          props: {
            customerName: apptView.customerName ?? customerEmail,
            serviceTypeName,
            scheduledAt: apptView.scheduledAt,
            cancellationReason: body.reason ?? undefined,
          },
        },
        pubLogger
      );
    }

    return reply.send(ok(apptView));
  });
};

function buildVehicleDescription(ref: Record<string, unknown>): string {
  const parts: string[] = [];
  if (ref.year) parts.push(String(ref.year));
  if (ref.make) parts.push(String(ref.make));
  if (ref.model) parts.push(String(ref.model));
  if (ref.vin) parts.push(`VIN: ${ref.vin}`);
  return parts.join(' ');
}

export default b2bSchedulingRoutes;
