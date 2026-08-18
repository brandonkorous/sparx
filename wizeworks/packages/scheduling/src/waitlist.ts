// Service-level waitlist (docs/79 §5/§7). "Notify me when this service has an
// opening in this window (optionally with this resource)." When a slot frees, the
// next waiting customer is OFFERED it (status → offered, with a TTL); they accept
// by booking a concrete slot in their window, which marks the entry `booked`.
// Session-level "this specific full class" waiting is a BookingAttendee with status
// `waitlisted` (classes); this is the broader any-opening intent.
//
// The engine owns the state machine + the booking on accept; the api-rest waitlist
// tick drives auto-offer (checks live availability) + the offer email + expiry.

import {
  withTenant,
  type Booking,
  type Prisma,
  type TxClient,
  type WaitlistEntry,
} from '@wizeworks/db';
import type { AcceptWaitlistInput, CreateWaitlistEntryInput } from '@wizeworks/scheduling-schemas';

import { createBooking } from './booking-service';
import {
  InvalidWaitlistStateError,
  ServiceNotFoundError,
  WaitlistEntryNotFoundError,
} from './errors';

const MINUTE_MS = 60_000;
const ACTIVE_STATUSES = ['waiting', 'offered'];

export async function joinWaitlist(
  tenantId: string,
  input: CreateWaitlistEntryInput
): Promise<WaitlistEntry> {
  return withTenant({ tenantId }, async (tx) => {
    const service = await tx.schedulingService.findFirst({
      where: { id: input.serviceId, deletedAt: null },
      select: { id: true },
    });
    if (!service) throw new ServiceNotFoundError(input.serviceId);
    // Dedupe: one active entry per service+customer — return the existing one.
    const existing = await tx.waitlistEntry.findFirst({
      where: {
        serviceId: input.serviceId,
        customerId: input.customerId,
        status: { in: ACTIVE_STATUSES },
      },
    });
    if (existing) return existing;
    return tx.waitlistEntry.create({
      data: {
        tenantId,
        serviceId: input.serviceId,
        customerId: input.customerId,
        resourcePref: input.resourcePref ?? null,
        desiredFrom: new Date(input.desiredFrom),
        desiredTo: new Date(input.desiredTo),
        status: 'waiting',
      },
    });
  });
}

export interface ListWaitlistOptions {
  serviceId?: string;
  status?: string;
  customerId?: string;
  /** Free-text over the waiting customer's name/email + the service name. */
  q?: string;
  /** Page size (1–250, default 50). */
  take?: number;
  /** Rows to skip for paging (default 0). */
  skip?: number;
}

export async function listWaitlist(
  tenantId: string,
  opts: ListWaitlistOptions = {}
): Promise<WaitlistEntry[]> {
  return withTenant({ tenantId }, (tx) =>
    tx.waitlistEntry.findMany({
      where: {
        ...(opts.serviceId ? { serviceId: opts.serviceId } : {}),
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.customerId ? { customerId: opts.customerId } : {}),
      },
      orderBy: { createdAt: 'asc' },
    })
  );
}

export interface WaitlistEntryDetail extends WaitlistEntry {
  serviceName: string | null;
  customerName: string;
  customerEmail: string | null;
}

/** The base WHERE the serviceId / status / customerId filters build. Search is
 *  layered on top separately because it needs a customer-id lookup first. */
function waitlistBaseWhere(opts: ListWaitlistOptions): Prisma.WaitlistEntryWhereInput {
  return {
    ...(opts.serviceId ? { serviceId: opts.serviceId } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.customerId ? { customerId: opts.customerId } : {}),
  };
}

/**
 * Like {@link listWaitlist} but joined with the service + customer display fields
 * the dashboard needs (batch-loaded, no N+1), and PAGED with a total count so it
 * holds up past a handful of entries.
 *
 * Search runs in the DB `where`, never as a post-filter on the loaded page — so
 * the count and the page agree. The `WaitlistEntry` model has no `customer`
 * relation, so a name/email needle is first resolved to the matching customer
 * ids, then OR-ed with a service-name match; both are real query predicates.
 */
export async function listWaitlistDetailed(
  tenantId: string,
  opts: ListWaitlistOptions = {}
): Promise<{ rows: WaitlistEntryDetail[]; total: number }> {
  const take = Math.min(Math.max(opts.take ?? 50, 1), 250);
  const skip = Math.max(opts.skip ?? 0, 0);
  const needle = opts.q?.trim();
  return withTenant({ tenantId }, async (tx) => {
    const base = waitlistBaseWhere(opts);
    let where: Prisma.WaitlistEntryWhereInput = base;
    if (needle) {
      const matched = await tx.customer.findMany({
        where: {
          OR: [
            { firstName: { contains: needle, mode: 'insensitive' } },
            { lastName: { contains: needle, mode: 'insensitive' } },
            { email: { contains: needle, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 500,
      });
      where = {
        AND: [
          base,
          {
            OR: [
              { customerId: { in: matched.map((c) => c.id) } },
              { service: { is: { name: { contains: needle, mode: 'insensitive' } } } },
            ],
          },
        ],
      };
    }
    const [rows, total] = await Promise.all([
      tx.waitlistEntry.findMany({ where, orderBy: { createdAt: 'asc' }, take, skip }),
      tx.waitlistEntry.count({ where }),
    ]);
    if (rows.length === 0) return { rows: [], total };
    const serviceIds = [...new Set(rows.map((r) => r.serviceId))];
    const customerIds = [...new Set(rows.map((r) => r.customerId))];
    const [services, customers] = await Promise.all([
      tx.schedulingService.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, name: true },
      }),
      tx.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
    ]);
    const svc = new Map(services.map((s) => [s.id, s.name]));
    const cust = new Map(customers.map((c) => [c.id, c]));
    const detailed = rows.map((r) => {
      const c = cust.get(r.customerId);
      const name = [c?.firstName, c?.lastName].filter(Boolean).join(' ');
      return {
        ...r,
        serviceName: svc.get(r.serviceId) ?? null,
        customerName: name.length > 0 ? name : (c?.email ?? 'Customer'),
        customerEmail: c?.email ?? null,
      };
    });
    return { rows: detailed, total };
  });
}

async function loadEntry(tx: TxClient, id: string): Promise<WaitlistEntry> {
  const entry = await tx.waitlistEntry.findUnique({ where: { id } });
  if (!entry) throw new WaitlistEntryNotFoundError(id);
  return entry;
}

export async function leaveWaitlist(tenantId: string, id: string): Promise<WaitlistEntry> {
  return withTenant({ tenantId }, async (tx) => {
    const entry = await loadEntry(tx, id);
    if (['booked', 'cancelled'].includes(entry.status)) {
      throw new InvalidWaitlistStateError(`Cannot cancel a waitlist entry that is ${entry.status}`);
    }
    return tx.waitlistEntry.update({ where: { id }, data: { status: 'cancelled' } });
  });
}

/** Mark a waiting entry `offered` with a TTL. The caller (tick / route) sends the
 *  offer notification — the engine only owns the state. */
export async function offerWaitlistEntry(
  tenantId: string,
  id: string,
  offerTtlMinutes = 60
): Promise<WaitlistEntry> {
  return withTenant({ tenantId }, async (tx) => {
    const entry = await loadEntry(tx, id);
    if (entry.status !== 'waiting') {
      throw new InvalidWaitlistStateError(`Cannot offer a waitlist entry that is ${entry.status}`);
    }
    const now = new Date();
    return tx.waitlistEntry.update({
      where: { id },
      data: {
        status: 'offered',
        offeredAt: now,
        offerExpiresAt: new Date(now.getTime() + offerTtlMinutes * MINUTE_MS),
      },
    });
  });
}

export interface AcceptedWaitlist {
  entry: WaitlistEntry;
  booking: Booking;
}

/** Accept an offer by booking a concrete slot inside the entry's window. The
 *  booking goes through the normal allocation + no-overlap guarantee; on success
 *  the entry is marked `booked`. A lost race surfaces as SlotUnavailableError and
 *  leaves the offer open to retry. */
export async function acceptWaitlistOffer(
  tenantId: string,
  input: AcceptWaitlistInput
): Promise<AcceptedWaitlist> {
  const entry = await withTenant({ tenantId }, (tx) => loadEntry(tx, input.id));
  if (entry.status !== 'offered') {
    throw new InvalidWaitlistStateError(`This offer is ${entry.status}`);
  }
  if (entry.offerExpiresAt && entry.offerExpiresAt.getTime() < Date.now()) {
    throw new InvalidWaitlistStateError('This offer has expired');
  }
  const start = new Date(input.startAt).getTime();
  if (start < entry.desiredFrom.getTime() || start > entry.desiredTo.getTime()) {
    throw new InvalidWaitlistStateError('That time is outside the requested window');
  }

  const resourceIds = input.resourceIds.length
    ? input.resourceIds
    : entry.resourcePref
      ? [entry.resourcePref]
      : [];
  const created = await createBooking(tenantId, {
    serviceId: entry.serviceId,
    startAt: input.startAt,
    customerId: entry.customerId,
    resourceIds,
    partsLinked: [],
    attendees: [],
    source: 'dashboard',
  });
  const updated = await withTenant({ tenantId }, (tx) =>
    tx.waitlistEntry.update({ where: { id: input.id }, data: { status: 'booked' } })
  );
  return { entry: updated, booking: created.booking };
}

/** Expire stale entries (terminal `expired`): an offer whose hold TTL has passed,
 *  or a still-`waiting` entry whose requested window is entirely in the past (it can
 *  never be fulfilled). Returns the count expired. The tick runs this first. */
export async function expireWaitlistOffers(tenantId: string): Promise<number> {
  return withTenant({ tenantId }, async (tx) => {
    const now = new Date();
    const [offers, stale] = await Promise.all([
      tx.waitlistEntry.updateMany({
        where: { status: 'offered', offerExpiresAt: { lt: now } },
        data: { status: 'expired' },
      }),
      tx.waitlistEntry.updateMany({
        where: { status: 'waiting', desiredTo: { lt: now } },
        data: { status: 'expired' },
      }),
    ]);
    return offers.count + stale.count;
  });
}
