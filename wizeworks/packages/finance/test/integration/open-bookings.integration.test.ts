// Appointments that happened and were never closed (persona issue 926).
//
// By job counts an appointment once it is marked completed. Nothing closes a
// past one on its own, so a salon that never pressed Complete saw "No completed
// work in this period" over a month of appointments. The count says how many.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '@wizeworks/db';

import { openPastBookingCount } from '../../src/index';
import { createTestTenant, day, dropTestTenant, type TestTenant } from '../helpers';

let t: TestTenant;
const NOW = new Date('2027-05-20T18:00:00.000Z');

beforeAll(async () => {
  t = await createTestTenant();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${t.tenantId}'`);
    const service = await tx.schedulingService.create({
      data: { tenantId: t.tenantId, name: 'Cut and finish', propertyId: t.propertyId },
    });
    const at = (iso: string, status: string) => ({
      tenantId: t.tenantId,
      serviceId: service.id,
      propertyId: t.propertyId,
      bookingType: 'appointment',
      startAt: new Date(iso),
      endAt: new Date(new Date(iso).getTime() + 60 * 60 * 1000),
      status,
    });
    await tx.booking.createMany({
      data: [
        at('2027-05-02T15:00:00.000Z', 'confirmed'), // happened, never closed
        at('2027-05-09T15:00:00.000Z', 'in_progress'), // started, never closed
        at('2027-05-12T15:00:00.000Z', 'completed'), // closed: By job has it
        at('2027-05-14T15:00:00.000Z', 'no_show'), // closed the other way
        at('2027-05-16T15:00:00.000Z', 'cancelled'),
        at('2027-05-20T20:00:00.000Z', 'confirmed'), // later today: not yet
        at('2027-05-28T15:00:00.000Z', 'confirmed'), // still to come
      ],
    });
  });
});

afterAll(async () => {
  await dropTestTenant(t.tenantId);
});

describe('appointments that happened and are still open', () => {
  it('counts the confirmed and in-progress ones in the past, and nothing else', async () => {
    const n = await openPastBookingCount(
      t.tenantId,
      { from: day('2027-05-01'), to: day('2027-05-31'), propertyId: t.propertyId },
      NOW
    );
    expect(n).toBe(2);
  });

  it('stays inside the period asked for', async () => {
    const n = await openPastBookingCount(
      t.tenantId,
      { from: day('2027-05-05'), to: day('2027-05-10'), propertyId: t.propertyId },
      NOW
    );
    expect(n).toBe(1);
  });
});
