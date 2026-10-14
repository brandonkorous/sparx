import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The sales tax on a sale at the counter (sparx persona issue 230).
 *
 * MEASURED 2026-10-13 on Gillett Diesel: Doty rang up an Edge CTS3 Backup Camera,
 * $299.95, for Brynn O'Hara-Løvdal. Take a sale asked for $299.95; Utah's 7.25%
 * was never added, though the website's checkout charges it on the same part
 * collected at the same counter. The real tax engine runs below, against Gillett's
 * one Utah place; only the database is faked.
 */

const CAMERA = '0b6c1a43-6c55-4b8a-9d7e-2b1f4a9e7c01';
const CAMERA_PRODUCT = '7f3e2d1c-0b9a-4c8d-8e7f-6a5b4c3d2e1f';
const OMALLEY_RANCH = 'c0ffee00-0000-4000-8000-0000000000aa';
const UTAH = {
  id: 'zone-ut',
  country: 'US',
  region: 'US-UT',
  rates: [{ name: 'Utah sales tax (Bluffdale)', rateBasisPoints: 725, productTaxClass: null }],
};

let certificates: { id: string; jurisdiction: string; validFrom: Date; validTo: Date | null }[] =
  [];

const tx = {
  taxZone: { findMany: vi.fn(() => Promise.resolve([UTAH])) },
  productVariant: {
    findMany: vi.fn(() =>
      Promise.resolve([{ id: CAMERA, productId: CAMERA_PRODUCT, product: { taxClass: null } }])
    ),
  },
  customer: { findFirst: vi.fn(() => Promise.resolve({ companyId: null })) },
  taxExemption: { findMany: vi.fn(() => Promise.resolve(certificates)) },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('./shipping-request-resolver', () => ({
  resolveShipFromAddress: () =>
    Promise.resolve({
      line1: '14812 Heritagecrest Way',
      city: 'Bluffdale',
      region: 'UT',
      postalCode: '84065',
      country: 'US',
    }),
}));

const { quoteTaxForSale } = await import('./sale-tax');
const ctx = { tenantId: '5944fe23-be83-4ce5-aafc-ef56b8594508' };
const brynn = 'b0000000-0000-4000-8000-0000000000bb';

beforeEach(() => {
  certificates = [];
});

describe('the sales tax on a counter sale', () => {
  it("is Utah's 7.25%, at the shop", async () => {
    const quote = await quoteTaxForSale(ctx, {
      customerId: brynn,
      lines: [{ ref: 'l_camera', variantId: CAMERA, quantity: 1, unitPriceCents: 29_995 }],
    });
    expect(quote.totalTaxCents).toBe(2_175);
    expect(quote.lines).toEqual([{ ref: 'l_camera', taxAmountCents: 2_175 }]);
    expect(quote.rateBasisPoints).toBe(725);
  });

  it('taxes a line typed in by hand, and an hour of labor, as well', async () => {
    const quote = await quoteTaxForSale(ctx, {
      customerId: brynn,
      lines: [
        { ref: 'l_camera', variantId: CAMERA, quantity: 1, unitPriceCents: 29_995 },
        { ref: 'l_fitting', variantId: null, quantity: 1, unitPriceCents: 9_500 },
      ],
    });
    expect(quote.lines).toEqual([
      { ref: 'l_camera', taxAmountCents: 2_175 },
      { ref: 'l_fitting', taxAmountCents: 689 },
    ]);
    expect(quote.totalTaxCents).toBe(2_864);
  });

  it('is on the price this customer is charged, after any lower price', async () => {
    // $299.95 less 15%, $254.96.
    const quote = await quoteTaxForSale(ctx, {
      customerId: brynn,
      lines: [{ ref: 'l_camera', variantId: CAMERA, quantity: 1, unitPriceCents: 25_496 }],
    });
    expect(quote.totalTaxCents).toBe(1_848);
  });

  it('is nothing for a buyer with a certificate for Utah on file', async () => {
    certificates = [
      {
        id: OMALLEY_RANCH,
        jurisdiction: 'US-UT',
        validFrom: new Date('2026-01-01'),
        validTo: null,
      },
    ];
    const quote = await quoteTaxForSale(ctx, {
      customerId: brynn,
      lines: [{ ref: 'l_camera', variantId: CAMERA, quantity: 1, unitPriceCents: 29_995 }],
    });
    expect(quote.totalTaxCents).toBe(0);
    expect(quote.certificateOnFile).toBe(true);
  });

  it('is nothing, and no rate, when there is nothing on the sale', async () => {
    const quote = await quoteTaxForSale(ctx, { customerId: brynn, lines: [] });
    expect(quote).toEqual({
      totalTaxCents: 0,
      rateBasisPoints: null,
      lines: [],
      certificateOnFile: false,
    });
  });
});
