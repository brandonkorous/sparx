import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A TRADE ACCOUNT'S CERTIFICATE THAT CHECKOUT NEVER READ (issue 075).
 *
 * A reseller's tax exemption certificate is kept on the business, not on each
 * person who orders for it: O'Malley Ranch & Hay Co. holds one agricultural
 * certificate for Utah, and whoever at the ranch places the order is buying for
 * the ranch. Checkout read certificates by the CUSTOMER only, so the one on the
 * account was never looked at and every one of its buyers was charged sales tax
 * the shop had paperwork to stop.
 *
 * The fake `taxExemption.findMany` below answers the `where` it is actually
 * given, so a query that asks only about the customer gets only the customer's
 * certificate, exactly as the database would.
 */

interface Certificate {
  id: string;
  customerId: string | null;
  companyId: string | null;
}

let certificates: Certificate[] = [];
let primaryAccount: string | null = null;
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
  cart: {
    findFirst: vi.fn(() =>
      Promise.resolve({ id: 'cart-1', customerId: 'cust-1', channel: 'storefront' })
    ),
  },
  cartItem: {
    findMany: vi.fn(() =>
      Promise.resolve([
        {
          id: 'line-1',
          quantity: 4,
          unitPriceCents: 3_899,
          variantId: 'var-1',
          variant: { productId: 'prod-1', product: { taxClass: null } },
        },
      ])
    ),
  },
  cartDiscount: { findMany: vi.fn(() => Promise.resolve([])) },
  customer: {
    findFirst: vi.fn(() => Promise.resolve({ companyId: primaryAccount })),
  },
  b2bAccountContact: {
    findFirst: vi.fn(() => Promise.resolve(activeOnAccount ? { id: 'contact-1' } : null)),
  },
  taxExemption: {
    findMany: vi.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(certificates.filter((row) => matches(row, where)).map(({ id }) => ({ id })))
    ),
  },
};

const calculate = vi.fn();

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('./tax-service', () => ({ calculate }));
vi.mock('./shipping-request-resolver', () => ({
  resolveShipFromAddress: () => Promise.resolve({ country: 'US', region: 'ID' }),
}));

const { quoteTaxForSession } = await import('./checkout-service');

const RANCH = '0b8c5f0e-3d4a-4c55-9a51-6f1f2d0c7a11';

const TO_UTAH = {
  line1: '2210 W Center St',
  city: 'Provo',
  region: 'UT',
  postalCode: '84601',
  country: 'US',
};

async function exemptionsSentFor(customerId: string | null): Promise<string[]> {
  await quoteTaxForSession(
    { tenantId: 't-1' },
    {
      cartId: 'cart-1',
      customerId,
      shippingAddress: TO_UTAH,
      shippingAmountCents: 1_500,
    }
  );
  const request = calculate.mock.calls.at(-1)?.[1] as { customerExemptionIds: string[] };
  return [...request.customerExemptionIds].sort();
}

beforeEach(() => {
  certificates = [];
  primaryAccount = RANCH;
  activeOnAccount = true;
  calculate.mockReset().mockResolvedValue({ totalTaxCents: 0, lines: [] });
  tx.taxExemption.findMany.mockClear();
});

describe('quoteTaxForSession: whose certificates count', () => {
  it("applies the certificate filed on the buyer's wholesale account", async () => {
    certificates = [{ id: 'cert-ranch-ag-ut', customerId: null, companyId: RANCH }];

    expect(await exemptionsSentFor('cust-1')).toEqual(['cert-ranch-ag-ut']);
  });

  it("still applies the buyer's own certificate, alongside the account's", async () => {
    certificates = [
      { id: 'cert-own', customerId: 'cust-1', companyId: null },
      { id: 'cert-ranch-ag-ut', customerId: null, companyId: RANCH },
    ];

    expect(await exemptionsSentFor('cust-1')).toEqual(['cert-own', 'cert-ranch-ag-ut']);
  });

  it('does not lend an account certificate to someone no longer ordering for it', async () => {
    // Same rule as the account's prices and terms: a contact who has been taken
    // off the account buys as themselves.
    activeOnAccount = false;
    certificates = [{ id: 'cert-ranch-ag-ut', customerId: null, companyId: RANCH }];

    expect(await exemptionsSentFor('cust-1')).toEqual([]);
  });

  it("never reads another account's certificate", async () => {
    certificates = [
      { id: 'cert-someone-else', customerId: null, companyId: 'another-account' },
      { id: 'cert-other-shopper', customerId: 'cust-2', companyId: null },
    ];

    expect(await exemptionsSentFor('cust-1')).toEqual([]);
  });

  it('asks nothing for a guest, who has no record to hold a certificate', async () => {
    certificates = [{ id: 'cert-ranch-ag-ut', customerId: null, companyId: RANCH }];

    expect(await exemptionsSentFor(null)).toEqual([]);
    expect(tx.taxExemption.findMany).not.toHaveBeenCalled();
  });
});
