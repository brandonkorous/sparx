// A booking as a fleet SERVICE RECORD, from the staff side (sparx persona issue 086):
// which trade account and vehicle it was for, and the parts from that account's
// orders that went into it.
//
//   GET /v1/scheduling/bookings/:id/service-record?q=
//       → { company, vehicle, parts, accounts, vehicles, orders }
//         `accounts` are the trade accounts the booked customer is a contact on
//         (what the vehicle picker offers when the booking has no account yet);
//         `vehicles` and `orders` are the chosen account's fleet and orders, the
//         choices for the vehicle and the parts.
//   PUT /v1/scheduling/bookings/:id/vehicle   { companyId, vehicleId }
//       → set, change or clear the account and vehicle
//   PUT /v1/scheduling/bookings/:id/parts     { parts: [{ orderItemId, quantity }] }
//       → the parts on the visit, ticked from the account's orders
//   GET /v1/scheduling/fleet/accounts/:companyId/service-history
//       → { enabled, records } the account's visits, newest first
//
// The account's orders are the orders of its contacts: an order carries the
// customer who placed it, not the account (the portal's own summary reads them
// the same way). Every write goes through `updateBooking`, so the change lands in
// the booking's history with the value it replaced.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { isModuleEnabled } from '@wizeworks/auth';
import { withTenant } from '@wizeworks/db';
import { requireRole } from '@wizeworks/api-core/auth';
import { ok } from '@wizeworks/api-core/envelope';
import { notFound, validationError } from '@wizeworks/api-core/errors';
import { findFleetVehicle, getAccountFleet } from '@wizeworks/b2b';
import { vehicleLabel } from '@wizeworks/commerce-schemas';
import { getBooking, updateBooking } from '@wizeworks/scheduling';
import { requireSchedulingModule, toSchedulingContext } from '../../../lib/scheduling-context.js';
import {
  buildLinkedParts,
  PartLinkError,
  readLinkedParts,
  readVehicleSnapshot,
  SERVICE_RECORD_SELECT,
  toServiceRecord,
  vehicleSnapshot,
  type LinkableOrder,
} from '../../../lib/fleet-service-records.js';

const PathId = z.object({ id: z.string().uuid() });
const PathCompany = z.object({ companyId: z.string().uuid() });
const RecordQuery = z.object({ q: z.string().trim().max(63).optional() });

const SetVehicleBody = z.object({
  companyId: z.string().uuid().nullable(),
  vehicleId: z.string().trim().min(1).max(100).nullable(),
});

const SetPartsBody = z.object({
  parts: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        quantity: z.number().int().min(1).max(100000),
      })
    )
    .max(200),
});

/** How many of the account's orders the parts picker offers at once. */
const ORDER_LIMIT = 50;
const HISTORY_LIMIT = 200;

type Tx = Parameters<Parameters<typeof withTenant>[1]>[0];

/** The customers who buy for an account, past and present: an order a former
 *  buyer placed for the account is still the account's order. */
async function accountCustomerIds(tx: Tx, companyId: string): Promise<string[]> {
  const rows = await tx.b2bAccountContact.findMany({
    where: { accountId: companyId },
    select: { customerId: true },
  });
  return rows.map((r) => r.customerId);
}

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  placedAt: true,
  items: {
    select: { id: true, variantId: true, productId: true, sku: true, name: true, quantity: true },
  },
} as const;

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const schedulingBookingFleetRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/scheduling/bookings/:id/service-record', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'viewer');
    const { tenantId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const { q } = RecordQuery.parse(request.query);
    const ctx = { tenantId };
    const booking = await getBooking(tenantId, id);

    const data = await withTenant(ctx, async (tx) => {
      const company = booking.companyId
        ? await tx.company.findFirst({
            where: { id: booking.companyId, deletedAt: null },
            select: { id: true, companyName: true },
          })
        : null;
      // The accounts the booked person buys for: the choices when the booking
      // has no account on it yet (a contact who booked on the public site).
      const accounts = booking.customerId
        ? await tx.b2bAccountContact.findMany({
            where: { customerId: booking.customerId, isActive: true, account: { deletedAt: null } },
            select: { account: { select: { id: true, companyName: true } } },
          })
        : [];
      const orders = company
        ? await tx.order.findMany({
            where: {
              customerId: { in: await accountCustomerIds(tx, company.id) },
              status: { not: 'cancelled' },
              ...(q ? { orderNumber: { contains: q, mode: 'insensitive' as const } } : {}),
            },
            select: ORDER_SELECT,
            orderBy: { placedAt: 'desc' },
            take: ORDER_LIMIT,
          })
        : [];
      return { company, accounts: accounts.map((a) => a.account), orders };
    });

    const fleet = data.company ? await getAccountFleet(ctx, data.company.id) : [];
    return ok({
      company: data.company,
      vehicle: readVehicleSnapshot(booking.assetRef),
      parts: readLinkedParts(booking.partsLinked),
      accounts: data.accounts,
      vehicles: fleet.map((v) => ({ id: v.id, label: vehicleLabel(v), vin: v.vin })),
      orders: data.orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        placedAt: o.placedAt.toISOString(),
        items: o.items,
      })),
    });
  });

  app.put('/v1/scheduling/bookings/:id/vehicle', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId, userId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const body = SetVehicleBody.parse(request.body);
    const ctx = { tenantId };
    const booking = await getBooking(tenantId, id);

    if (body.vehicleId && !body.companyId) {
      throw validationError('Pick the trade account before its vehicle.');
    }
    // Parts come from ONE account's orders. Moving the visit to another account
    // with them still on it would file that account's parts under a stranger's
    // truck, so they come off first, on purpose, by someone who can see them.
    const nextCompany = body.companyId ?? null;
    if (nextCompany !== booking.companyId && readLinkedParts(booking.partsLinked).length > 0) {
      throw validationError(
        "Take the parts off this visit before moving it to another account: they came from the current account's orders."
      );
    }

    let assetRef: Record<string, unknown> | null = null;
    if (body.companyId) {
      const company = await withTenant(ctx, (tx) =>
        tx.company.findFirst({
          where: { id: body.companyId!, deletedAt: null },
          select: { id: true },
        })
      );
      if (!company) throw notFound('Trade account', body.companyId);
      if (body.vehicleId) {
        // Looked up in THAT account's fleet: a vehicle from another account is
        // not found, never filed here.
        const vehicle = await findFleetVehicle(ctx, body.companyId, body.vehicleId);
        if (!vehicle) throw notFound('Vehicle', body.vehicleId);
        assetRef = { ...vehicleSnapshot(vehicle) };
      }
    }

    await updateBooking(tenantId, { id, companyId: nextCompany, assetRef }, userId);
    return ok({ companyId: nextCompany, vehicle: readVehicleSnapshot(assetRef) });
  });

  app.put('/v1/scheduling/bookings/:id/parts', async (request) => {
    await requireSchedulingModule(request);
    requireRole(request, 'editor');
    const { tenantId, userId } = toSchedulingContext(request);
    const { id } = PathId.parse(request.params);
    const body = SetPartsBody.parse(request.body);
    const booking = await getBooking(tenantId, id);
    const companyId = booking.companyId;
    if (!companyId && body.parts.length > 0) {
      throw validationError('Put this visit on a trade account first: parts come from its orders.');
    }

    const orders: LinkableOrder[] =
      companyId && body.parts.length > 0
        ? await withTenant({ tenantId }, async (tx) =>
            tx.order.findMany({
              where: {
                // The account's own orders, holding one of the ticked lines.
                customerId: { in: await accountCustomerIds(tx, companyId) },
                items: { some: { id: { in: body.parts.map((p) => p.orderItemId) } } },
              },
              select: ORDER_SELECT,
            })
          )
        : [];

    let parts;
    try {
      parts = buildLinkedParts(body.parts, orders);
    } catch (err) {
      if (err instanceof PartLinkError) throw validationError(err.message);
      throw err;
    }
    await updateBooking(tenantId, { id, partsLinked: parts }, userId);
    return ok({ parts: readLinkedParts(parts) });
  });

  app.get('/v1/scheduling/fleet/accounts/:companyId/service-history', async (request) => {
    requireRole(request, 'viewer');
    const { tenantId } = toSchedulingContext(request);
    const { companyId } = PathCompany.parse(request.params);
    // Asked from the account screen, which exists whether or not scheduling does:
    // an answer of "off" lets it show nothing, where a refusal would show an error.
    if (!(await isModuleEnabled(tenantId, 'scheduling'))) return ok({ enabled: false });
    const rows = await withTenant({ tenantId }, (tx) =>
      tx.booking.findMany({
        where: { companyId, deletedAt: null },
        select: SERVICE_RECORD_SELECT,
        orderBy: { startAt: 'desc' },
        take: HISTORY_LIMIT,
      })
    );
    return ok({ enabled: true, records: rows.map((r) => toServiceRecord(r, { staff: true })) });
  });
};

export default schedulingBookingFleetRoutes;
