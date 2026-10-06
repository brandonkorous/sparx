import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RateOption } from '@wizeworks/commerce-schemas';

/**
 * A REPEAT DELIVERY READS THE SAME CERTIFICATES CHECKOUT DOES (issue 075).
 *
 * A repeat order is the first purchase again, so a certificate filed on the
 * buyer's wholesale account has to keep covering it. The renewal pricer read
 * certificates by the customer only, the same blind spot checkout had.
 *
 * `taxExemption.findMany` answers the `where` it is given, so a query that only
 * asks about the customer only finds the customer's certificate.
 */

interface Certificate {
  id: string;
  customerId: string | null;
  companyId: string | null;
}

const HOGBERG = '5f0b1c2d-8e7a-4b3c-9d1e-2a3b4c5d6e7f';
let certificates: Certificate[] = [];
let activeOnAccount = true;

function matches(row: Certificate, where: Record<string, unknown>): boolean {
  if (Array.isArray(where.OR)) {
    return (where.OR as Record<string, unknown>[]).some((branch) => matches(row, branch));
  }
  if ('customerId' in where && row.customerId !== where.customerId) return false;
  if ('companyId' in where && row.companyId !== where.companyId) return false;
  return true;
}

const tx = {
  customer: { findFirst: vi.fn(() => Promise.resolve({ companyId: HOGBERG })) },
  b2bAccountContact: {
    findFirst: vi.fn(() => Promise.resolve(activeOnAccount ? { id: 'contact-1' } : null)),
  },
  taxExemption: {
    findMany: vi.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(certificates.filter((row) => matches(row, where)).map(({ id }) => ({ id })))
    ),
  },
};

const POST: RateOption = {
  providerSlug: 'sparx-manual',
  carrier: 'Standard',
  service: 'Freight',
  currency: 'USD',
  isFreight: false,
  rateRef: 'manual:freight',
  amountCents: 4_500,
};

const calculate = vi.fn();

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('./shipping-service', () => ({ quoteForLines: () => Promise.resolve([POST]) }));
vi.mock('./tax-service', () => ({ calculate }));
vi.mock('./shipping-request-resolver', () => ({
  resolveShipFromAddress: () => Promise.resolve({ country: 'US', region: 'ID' }),
}));

const { priceRenewal } = await import('./renewal-pricing');

async function exemptionsSent(): Promise<string[]> {
  await priceRenewal(
    { tenantId: 't-1' },
    {
      propertyId: null,
      currency: 'USD',
      customerId: 'cust-1',
      shippingAddress: {
        line1: '418 N Main St',
        city: 'Meridian',
        region: 'ID',
        postalCode: '83642',
        country: 'US',
      },
      choice: null,
      lines: [
        {
          variantId: 'var-1',
          productId: 'prod-1',
          taxClass: null,
          quantity: 2,
          unitPriceCents: 21_999,
        },
      ],
    }
  );
  const request = calculate.mock.calls.at(-1)?.[1] as { customerExemptionIds: string[] };
  return [...request.customerExemptionIds].sort();
}

beforeEach(() => {
  certificates = [];
  activeOnAccount = true;
  calculate.mockReset().mockResolvedValue({ totalTaxCents: 0, lines: [] });
});

describe('priceRenewal: whose certificates count', () => {
  it("applies the resale certificate filed on the buyer's wholesale account", async () => {
    certificates = [{ id: 'cert-hogberg-resale-id', customerId: null, companyId: HOGBERG }];

    expect(await exemptionsSent()).toEqual(['cert-hogberg-resale-id']);
  });

  it('does not lend it to someone no longer ordering for the account', async () => {
    activeOnAccount = false;
    certificates = [{ id: 'cert-hogberg-resale-id', customerId: null, companyId: HOGBERG }];

    expect(await exemptionsSent()).toEqual([]);
  });
});
