// A booking says WHO it is for, over HTTP, on the list and on the record.
//
// WHY THIS EXISTS. Issue 138 taught the read path to name the customer: a second
// read in `booking-queries.ts` (`customersFor`) fetches the linked customer and
// hangs it on every row as `customer`. The route's `bookingView` then rebuilt the
// row field by field and never copied it across, so the name was fetched, paid
// for, and thrown away one function before the wire. Both consoles went on
// printing "A customer" beside a booking whose customer the database had just
// named, and neither could show the phone number to ring when someone is late
// (issue 111). The package was right and the endpoint was wrong, which is the
// exact shape a package-level test cannot see, so this one asks the endpoint.
//
// Covered here:
//   · the list carries the named customer, phone included
//   · the single record carries the same
//   · a walk-in with no account carries `customer: null`, a real answer
//   · `customerId` narrows the list to that one person, which is what a
//     customer's record reads to show what they were ever booked for
//   · the diary read names the person AND carries the booking's own time zone,
//     which the grid places the block by (it drew in the viewer's zone before)

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma, withTenant } from '@wizeworks/db';
import { invalidateModuleCache } from '@wizeworks/auth';
import { createApp } from '../../src/app.js';
import { authHeader, createTestTenant, dropTestTenant, signToken } from '../helpers.js';

interface WireCustomer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

interface WireBooking {
  id: string;
  customerId: string | null;
  customer: WireCustomer | null;
}

describe('scheduling bookings name their customer', () => {
  let app: FastifyInstance;
  let tenantId: string;
  let token: string;
  let customerId: string;
  let otherCustomerId: string;
  let namedBookingId: string;
  let walkInBookingId: string;

  beforeAll(async () => {
    app = await createApp();
    const tenant = await createTestTenant();
    tenantId = tenant.tenantId;
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { modules: { scheduling: { enabled: true } } } },
    });
    token = signToken(app, tenant);

    const seeded = await withTenant({ tenantId }, async (tx) => {
      const service = await tx.schedulingService.create({
        data: { tenantId, name: 'Beard trim', durationMinutes: 30 },
        select: { id: true },
      });
      const mara = await tx.customer.create({
        data: {
          tenantId,
          firstName: 'Mara',
          lastName: 'Quill',
          email: 'mara.quill@example.test',
          phone: '+15555550142',
        },
        select: { id: true },
      });
      const other = await tx.customer.create({
        data: { tenantId, firstName: 'Otto', lastName: 'Fenn', email: 'otto@example.test' },
        select: { id: true },
      });
      const at = (hours: number) => new Date(Date.UTC(2031, 2, 4, hours));
      const base = { tenantId, serviceId: service.id, bookingType: 'appointment' };
      const named = await tx.booking.create({
        data: {
          ...base,
          customerId: mara.id,
          startAt: at(10),
          endAt: at(11),
          timezone: 'Asia/Tokyo',
        },
        select: { id: true },
      });
      const walkIn = await tx.booking.create({
        data: { ...base, customerId: null, startAt: at(12), endAt: at(13) },
        select: { id: true },
      });
      await tx.booking.create({
        data: { ...base, customerId: other.id, startAt: at(14), endAt: at(15) },
        select: { id: true },
      });
      return { mara: mara.id, other: other.id, named: named.id, walkIn: walkIn.id };
    });
    customerId = seeded.mara;
    otherCustomerId = seeded.other;
    namedBookingId = seeded.named;
    walkInBookingId = seeded.walkIn;
  });

  beforeEach(() => {
    invalidateModuleCache();
  });

  afterAll(async () => {
    await dropTestTenant(tenantId);
    await app.close();
    await prisma.$disconnect();
  });

  async function list(query = ''): Promise<WireBooking[]> {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/scheduling/bookings${query}`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    return res.json<{ data: WireBooking[] }>().data;
  }

  it('names the customer on every list row, phone included', async () => {
    const rows = await list();
    const named = rows.find((row) => row.id === namedBookingId);
    expect(named?.customer).toEqual({
      id: customerId,
      firstName: 'Mara',
      lastName: 'Quill',
      email: 'mara.quill@example.test',
      phone: '+15555550142',
    });
  });

  it('names the customer on the single record too', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/scheduling/bookings/${namedBookingId}`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    const booking = res.json<{ data: WireBooking }>().data;
    expect(booking.customer?.firstName).toBe('Mara');
    expect(booking.customer?.phone).toBe('+15555550142');
  });

  it('says null, not undefined, for a walk-in with no account', async () => {
    const rows = await list();
    const walkIn = rows.find((row) => row.id === walkInBookingId);
    expect(walkIn).toBeDefined();
    // `toBeNull` and not `toBeFalsy`: a key that is simply absent is the defect
    // this suite exists for, and it is falsy too.
    expect(walkIn?.customer).toBeNull();
  });

  it("narrows to one person's bookings when asked by customerId", async () => {
    const rows = await list(`?customerId=${customerId}`);
    expect(rows.map((row) => row.id)).toEqual([namedBookingId]);
    const others = await list(`?customerId=${otherCustomerId}`);
    expect(others.every((row) => row.customerId === otherCustomerId)).toBe(true);
    expect(others).toHaveLength(1);
  });

  it('gives the diary the name and the zone the booking was made in', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/scheduling/bookings/calendar?from=2031-03-04T00:00:00.000Z&to=2031-03-05T00:00:00.000Z',
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    const events = res.json<{
      data: { id: string; customerName: string | null; timezone: string }[];
    }>().data;
    const named = events.find((event) => event.id === namedBookingId);
    expect(named?.customerName).toBe('Mara Quill');
    expect(named?.timezone).toBe('Asia/Tokyo');
  });
});
