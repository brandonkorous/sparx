// A new service starts with the business's booking rules (sparx persona issue 135).
//
// MEASURED 2026-10-06 on Gillett Diesel: the Scheduling module had made a
// "Standard" rule set with reminders a day and two hours before, and none of his
// seven services used it, because every service started with no rules. Wade's
// booking got a confirmation and no reminder, while the site's Book page said
// "a reminder before the day".

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma, withTenant } from '@wizeworks/db';
import { createService } from '@wizeworks/scheduling';
import { CreateServiceInput } from '@wizeworks/scheduling-schemas';
import { createTestTenant, dropTestTenant } from '../helpers.js';

describe('creating a service', () => {
  let tenantId = '';
  let standardId = '';

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
    standardId = await withTenant({ tenantId }, async (tx) => {
      const standard = await tx.bookingPolicy.create({
        data: {
          tenantId,
          name: 'Standard',
          depositType: 'none',
          cancellationWindowHours: 24,
          reminderOffsetsMin: [1440, 120],
        },
        select: { id: true },
      });
      await tx.bookingPolicy.create({
        data: {
          tenantId,
          name: 'Dyno day deposit',
          depositType: 'fixed',
          depositAmountCents: 5000,
          cancellationWindowHours: 48,
          reminderOffsetsMin: [2880],
        },
      });
      return standard.id;
    });
  });

  afterAll(async () => {
    await dropTestTenant(tenantId);
    await prisma.$disconnect();
  });

  const input = (extra: Record<string, unknown>) =>
    CreateServiceInput.parse({
      bookingType: 'appointment',
      name: 'Diesel oil change',
      durationMinutes: 60,
      ...extra,
    });

  it('takes the first booking rules when it names none', async () => {
    const service = await createService(tenantId, input({}));
    expect(service.policyId).toBe(standardId);
  });

  it('keeps no rules when that is what was asked for', async () => {
    const service = await createService(tenantId, input({ policyId: null }));
    expect(service.policyId).toBeNull();
  });
});
