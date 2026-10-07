import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A QUOTED SERVICE CARRIES NO PRICE (sparx persona issue 117).
 *
 * Gillett's turbo rebuild and injector set are priced after the job has been
 * looked at. A quoted service is stored with no price, so the booking takes no
 * charge and no deposit, and a price sent alongside "quoted" does not stick.
 */

const TENANT = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const SERVICE = '6b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e';

let existing: { id: string; priceCents: number; priceOnQuote: boolean };

const tx = {
  schedulingService: {
    create: vi.fn((args: { data: Record<string, unknown> }) => Promise.resolve(args.data)),
    findFirst: vi.fn(() => Promise.resolve(existing)),
    update: vi.fn((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...existing, ...args.data })
    ),
  },
  // A new service takes the business's first booking rules (issue 135); none here.
  bookingPolicy: { findFirst: vi.fn(() => Promise.resolve(null)) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => fn(tx),
}));

const { CreateServiceInput } = await import('@wizeworks/scheduling-schemas');
const services = await import('./services');

beforeEach(() => {
  vi.clearAllMocks();
  existing = { id: SERVICE, priceCents: 0, priceOnQuote: false };
});

const written = (fn: 'create' | 'update'): Record<string, unknown> => {
  const call = tx.schedulingService[fn].mock.calls[0] as unknown as [
    { data: Record<string, unknown> },
  ];
  return call[0].data;
};

describe('a quoted service', () => {
  it('is created with no price, whatever was typed', async () => {
    await services.createService(
      TENANT,
      CreateServiceInput.parse({
        name: 'Turbocharger rebuild and balance',
        durationMinutes: 240,
        priceCents: 45000,
        priceOnQuote: true,
      })
    );
    expect(written('create')).toMatchObject({ priceCents: 0, priceOnQuote: true });
  });

  it('keeps no price when a price is sent to a quoted service', async () => {
    existing = { id: SERVICE, priceCents: 0, priceOnQuote: true };
    await services.updateService(TENANT, { id: SERVICE, priceCents: 45000 });
    expect(written('update')).toMatchObject({ priceCents: 0 });
  });

  it('a priced service keeps its price', async () => {
    await services.createService(
      TENANT,
      CreateServiceInput.parse({
        name: 'Pre-purchase inspection, used diesel truck',
        durationMinutes: 90,
        priceCents: 19500,
      })
    );
    expect(written('create')).toMatchObject({ priceCents: 19500, priceOnQuote: false });
  });
});
