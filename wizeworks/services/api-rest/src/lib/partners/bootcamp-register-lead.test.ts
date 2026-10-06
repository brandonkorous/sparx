// A bootcamp RSVP files the person as a lead in the host's CRM through the CRM's
// own lead capture, so they are announced and so a second RSVP finds them.
//
// It wrote the customer row itself and said nothing, so the host's search box
// never found anybody who signed up for their bootcamp (sparx persona issue
// 086). And it created a row every time: somebody already in the host's book, or
// signing up for a second cohort, hit the one-address-per-business rule, and
// inside a database transaction that failure is not survivable, so the catch
// around it could not save the RSVP it was written to save.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureLead = vi.fn();
const registrations: Record<string, unknown>[] = [];
const tx = {
  bootcampRegistration: {
    findUnique: () => Promise.resolve(null),
    create: ({ data }: { data: Record<string, unknown> }) => {
      registrations.push(data);
      return Promise.resolve({});
    },
  },
  bootcamp: { update: () => Promise.resolve({}) },
};

const HOST = '5944fe23-be83-4ce5-aafc-ef56b8594508';

vi.mock('@wizeworks/db', () => ({
  withSystem: () =>
    Promise.resolve({
      id: 'bc-1',
      tenantId: HOST,
      partnerId: 'p-1',
      title: 'Spring cohort',
      seatsTotal: null,
      seatsFilled: 0,
      registrationMode: 'internal',
    }),
  withTenant: (_ctx: unknown, fn: (t: unknown) => Promise<unknown>) => fn(tx),
}));
vi.mock('@wizeworks/crm', () => ({ customerService: { captureLead } }));
vi.mock('./events.js', () => ({ publishPartnerEvent: () => Promise.resolve() }));

const { bootcampService } = await import('./bootcamp-service.js');

beforeEach(() => {
  captureLead.mockReset().mockResolvedValue({ customer: { id: 'lead-1' }, created: true });
  registrations.length = 0;
});

describe('a bootcamp RSVP', () => {
  it('captures the person through the CRM, inside the RSVP transaction', async () => {
    await bootcampService.register('spring', {
      name: 'Marcus Oyelaran-Pike',
      email: 'marcus@example.test',
    });
    expect(captureLead).toHaveBeenCalledWith(
      { tenantId: HOST, tx },
      expect.objectContaining({
        email: 'marcus@example.test',
        name: 'Marcus Oyelaran-Pike',
        tags: ['bootcamp'],
        source: 'bootcamp',
      })
    );
    expect(registrations[0]).toMatchObject({ crmCustomerId: 'lead-1' });
  });
});
