import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * CORE DEPOSITS GO BACK THE WAY THE MONEY CAME (sparx persona issue 051).
 *
 * Gillett Diesel sells a rebuilt Bosch injector at $580.15 with a $150.00 core
 * deposit. When the old injector comes back fit to rebuild, the $150.00 goes back:
 * to the card it was paid on, onto the account as credit, or, for a fleet on Net
 * 30 whose invoice is still open, off that invoice. A cracked core keeps its
 * deposit, with the reason the counter gave. No path may give back more cores, or
 * more money, than are owed.
 */

const ITEM = '8f1c2a44-6b0e-4a1e-9c33-2d6f0a7b5e10';
const ORDER = '0b6f3c1d-5a2e-4f7b-8c9d-1e2f3a4b5c6d';
const CUSTOMER = 'e3ef888f-7702-4b10-ba30-9f3b4476d763';
const CTX = { tenantId: '2e78fb6c-a823-4698-bcb9-58a4f17710a0' };
const COMPANY = '5d2a7e90-3c41-4b8f-9e16-7a0b2c4d6e81';

interface Line {
  quantity: number;
  quantityRefunded: number;
  quantityFulfilled?: number;
  coresReturned: number;
  coresKept: number;
  coreCharge: number | null;
  coreFirst?: boolean;
  coreHoldReleasedAt?: Date | null;
}

let line: Line;
let invoice: { id: string; balance: number; number: string } | null;
let payment: { id: string; processor: string; processorRef: string; currency: string } | null;
let amountPaid: number;
/** The business record the customer belongs to, or null for a person buying alone. */
let account: { id: string; companyName: string } | null;

const itemUpdate = vi.fn();
const refund = vi.fn();
const recordRefund = vi.fn().mockResolvedValue({});
const recordPayment = vi.fn().mockResolvedValue({});
const grantAccountCredit = vi.fn().mockResolvedValue({ newBalanceCents: 0 });

function row() {
  return {
    id: ITEM,
    sku: '0986435621',
    name: 'Bosch Remanufactured Fuel Injector (0986435621)',
    quantityFulfilled: 0,
    coreFirst: false,
    coreHoldReleasedAt: null,
    ...line,
    order: {
      id: ORDER,
      orderNumber: 'O-000041',
      placedAt: new Date('2026-09-01T15:00:00Z'),
      currency: 'USD',
      status: 'fulfilled',
      customerId: CUSTOMER,
      customer: {
        firstName: 'Renée',
        lastName: 'Castañeda',
        // What they typed into their own profile, which is not the business record.
        companyName: account ? 'Wasatch Utility' : null,
        email: 'renee.castaneda@wasatchutility.test',
        companyId: account?.id ?? null,
        // What the client extension in @wizeworks/db hands back for a `company`
        // select on a customer: its own typed text again, never the joined record.
        company: account ? 'Wasatch Utility' : null,
      },
    },
  };
}

const tx = {
  orderItem: {
    findFirst: vi.fn(() => Promise.resolve(row())),
    findMany: vi.fn(() => Promise.resolve([row()])),
    update: itemUpdate.mockImplementation(
      (args: {
        data: {
          coresReturned?: { increment: number };
          coresKept?: { increment: number };
          coreHoldReleasedAt?: Date;
        };
      }) => {
        line.coresReturned += args.data.coresReturned?.increment ?? 0;
        line.coresKept += args.data.coresKept?.increment ?? 0;
        if (args.data.coreHoldReleasedAt) line.coreHoldReleasedAt = args.data.coreHoldReleasedAt;
        return Promise.resolve({
          coresKept: line.coresKept,
          coreHoldReleasedAt: line.coreHoldReleasedAt ?? null,
        });
      }
    ),
  },
  billingDocument: { findFirst: vi.fn(() => Promise.resolve(invoice)) },
  orderPayment: { findFirst: vi.fn(() => Promise.resolve(payment)) },
  order: { findUnique: vi.fn(() => Promise.resolve({ amountPaid })) },
  company: {
    findMany: vi.fn((args: { where: { id: { in: string[] } } }) =>
      Promise.resolve(account && args.where.id.in.includes(account.id) ? [account] : [])
    ),
  },
};

vi.mock('@wizeworks/db', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withTenant: (_ctx: unknown, fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
}));
vi.mock('@wizeworks/crm', () => ({
  billingPaymentService: { recordPayment },
  orderRefundsService: { recordRefund },
  OWED_DOCUMENT_WHERE: {},
}));
vi.mock('@wizeworks/payments', () => {
  class PaymentConfigError extends Error {}
  class GatewayNotFoundError extends Error {}
  return {
    PaymentConfigError,
    GatewayNotFoundError,
    paymentService: { refund },
    takenByGateway: (processor: string) => processor === 'stripe' || processor === 'paypal',
  };
});
vi.mock('./discount-service', () => ({ grantAccountCredit }));
vi.mock('../audit', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));

const { listOwed, receiveCores, keepDeposits, releaseHold } = await import('./core-service');

beforeEach(() => {
  line = { quantity: 2, quantityRefunded: 0, coresReturned: 0, coresKept: 0, coreCharge: 150 };
  invoice = null;
  payment = { id: 'pay-1', processor: 'stripe', processorRef: 'pi_123', currency: 'USD' };
  amountPaid = 1460.3;
  account = null;
  refund.mockReset().mockResolvedValue({ success: true, refundId: 're_789' });
  for (const fn of [itemUpdate, recordRefund, recordPayment, grantAccountCredit]) fn.mockClear();
});

describe('listOwed', () => {
  it('counts what is still owed and the money that would go back', async () => {
    line.coresReturned = 1;
    const [owed] = await listOwed(CTX);
    expect(owed).toMatchObject({ coresOwed: 1, coreChargeCents: 15_000, owedCents: 15_000 });
    expect(owed?.customerName).toBe('Renée Castañeda');
  });

  it('names the business the customer buys for, from its own record', async () => {
    account = { id: COMPANY, companyName: 'Wasatch Utility Cooperative' };
    const [owed] = await listOwed(CTX);
    expect(owed?.companyId).toBe(COMPANY);
    expect(owed?.companyName).toBe('Wasatch Utility Cooperative');
  });

  it('names no business for a customer who belongs to none', async () => {
    const [owed] = await listOwed(CTX);
    expect(owed?.companyName).toBeNull();
  });

  it('leaves out a line whose cores are all settled', async () => {
    line.coresReturned = 1;
    line.coresKept = 1;
    expect(await listOwed(CTX)).toEqual([]);
  });

  it('counts a part that came back itself as its own core', async () => {
    line.quantityRefunded = 2;
    expect(await listOwed(CTX)).toEqual([]);
  });
});

describe('receiveCores', () => {
  it('refunds a usable core to the card, and records the gateway refund id', async () => {
    const result = await receiveCores(CTX, { orderItemId: ITEM, usable: 1 });

    expect(refund).toHaveBeenCalledWith(
      expect.objectContaining({ chargeId: 'pi_123', amount: 15_000 })
    );
    expect(recordRefund).toHaveBeenCalledWith(
      expect.objectContaining({ tx }),
      expect.objectContaining({
        orderId: ORDER,
        paymentId: 'pay-1',
        amount: 150,
        processorRef: 're_789',
        reason: 'Core returned: Bosch Remanufactured Fuel Injector (0986435621)',
      })
    );
    expect(line.coresReturned).toBe(1);
    expect(result).toMatchObject({ refundedCents: 15_000, invoiceCreditCents: 0 });
    expect(result.summary).toBe('$150.00 refunded to the card.');
  });

  it('takes the deposit off a fleet’s open invoice instead of refunding money it never paid', async () => {
    invoice = { id: 'doc-1', balance: 1460.3, number: 'INV-1001' };
    amountPaid = 0;
    const result = await receiveCores(CTX, { orderItemId: ITEM, usable: 2 });

    expect(refund).not.toHaveBeenCalled();
    expect(recordRefund).not.toHaveBeenCalled();
    expect(recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ tx }),
      'doc-1',
      expect.objectContaining({ amount: 300, reference: 'Core returned' })
    );
    expect(result.summary).toBe('$300.00 taken off invoice INV-1001.');
  });

  it('puts the deposit on the account when the counter chooses credit', async () => {
    await receiveCores(CTX, { orderItemId: ITEM, usable: 1, refundTo: 'account_credit' });
    expect(refund).not.toHaveBeenCalled();
    expect(grantAccountCredit).toHaveBeenCalledWith(
      expect.objectContaining({ tx }),
      expect.objectContaining({ customerId: CUSTOMER, amountCents: 15_000, reason: 'refund' })
    );
  });

  it('keeps the deposit on a cracked core and says why', async () => {
    const result = await receiveCores(CTX, {
      orderItemId: ITEM,
      usable: 0,
      unusable: 1,
      note: 'Cracked nozzle body',
    });
    expect(refund).not.toHaveBeenCalled();
    expect(line.coresKept).toBe(1);
    expect(result.summary).toBe('1 deposit kept.');
  });

  it('refuses a cracked core without a reason', async () => {
    await expect(receiveCores(CTX, { orderItemId: ITEM, usable: 0, unusable: 1 })).rejects.toThrow(
      /why/
    );
  });

  it('refuses more cores than are owed, before any money moves', async () => {
    line.coresReturned = 2;
    await expect(receiveCores(CTX, { orderItemId: ITEM, usable: 1 })).rejects.toThrow(
      /No cores are still owed/
    );
    expect(refund).not.toHaveBeenCalled();
  });

  it('writes nothing when the card refund is refused', async () => {
    refund.mockResolvedValue({ success: false, errorMessage: 'charge_disputed' });
    await expect(receiveCores(CTX, { orderItemId: ITEM, usable: 1 })).rejects.toThrow(
      /refused: charge_disputed/
    );
    expect(itemUpdate).not.toHaveBeenCalled();
    expect(recordRefund).not.toHaveBeenCalled();
  });
});

describe('keepDeposits', () => {
  it('marks cores that are not coming back, without moving money', async () => {
    await keepDeposits(CTX, { orderItemId: ITEM, quantity: 2, note: 'Customer kept the old part' });
    expect(line.coresKept).toBe(2);
    expect(refund).not.toHaveBeenCalled();
  });
});

/**
 * THE OTHER WAY TO BUY IT (sparx persona issue 057). Half of Gillett's rebuilt
 * parts let the buyer send the old part FIRST: no deposit, and the part ships when
 * the old one arrives. Nothing is held, so nothing goes back; the counter records
 * the arrival, or chooses to ship without waiting.
 */
describe('a part bought by sending the old part first', () => {
  beforeEach(() => {
    line = {
      quantity: 1,
      quantityRefunded: 0,
      quantityFulfilled: 0,
      coresReturned: 0,
      coresKept: 0,
      coreCharge: null,
      coreFirst: true,
      coreHoldReleasedAt: null,
    };
  });

  it('is listed as owed and waiting to ship, with no money held', async () => {
    const [owed] = await listOwed(CTX);
    // The mock returns rows whatever the filter says, so the filter is asserted:
    // a line with no deposit is still read when its old part comes first.
    expect(tx.orderItem.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ coreCharge: { not: null } }, { coreFirst: true }],
        }),
      })
    );
    expect(owed).toMatchObject({
      coreFirst: true,
      coresOwed: 1,
      waitingToShip: 1,
      coreChargeCents: 0,
      owedCents: 0,
    });
  });

  it('records the arrival with no money moving, and says the part can go', async () => {
    const result = await receiveCores(CTX, { orderItemId: ITEM, usable: 1 });
    expect(refund).not.toHaveBeenCalled();
    expect(recordRefund).not.toHaveBeenCalled();
    expect(result.summary).toBe('1 part is ready to hand over or send.');
    expect(line.coresReturned).toBe(1);
  });

  it('refuses an unusable old part, since there is no deposit to keep', async () => {
    await expect(
      receiveCores(CTX, { orderItemId: ITEM, usable: 0, unusable: 1, note: 'Cracked body' })
    ).rejects.toThrow(/no deposit to keep/);
    expect(itemUpdate).not.toHaveBeenCalled();
  });

  it('refuses to keep a deposit nobody paid', async () => {
    await expect(
      keepDeposits(CTX, { orderItemId: ITEM, quantity: 1, note: 'Not coming back' })
    ).rejects.toThrow(/No deposit was paid/);
  });

  it('lets the business ship it before the old part arrives, with a reason', async () => {
    const result = await releaseHold(CTX, { orderItemId: ITEM, note: 'Fleet account, trusted' });
    expect(result.holdReleasedAt).toMatch(/^\d{4}-/);
    const [owed] = await listOwed(CTX);
    // Still owed, no longer holding the part back.
    expect(owed).toMatchObject({ coresOwed: 1, waitingToShip: 0 });
  });

  it('refuses to release a line that was paid for with a deposit', async () => {
    line = { ...line, coreFirst: false, coreCharge: 150 };
    await expect(releaseHold(CTX, { orderItemId: ITEM, note: 'x' })).rejects.toThrow(
      /nothing is waiting for it/
    );
  });
});
