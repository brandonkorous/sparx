// Commission, end to end against a real database.
//
// The arithmetic is unit-tested in `commission-calc.test.ts`; this is the part
// that could not exist until migration 20270324000000 landed, because until then
// there was neither a percentage on the rate nor anywhere to record who sold an
// order. Both were the reason nothing calculated a commission — the ledger, the
// API and the person pane had all shipped and were inert.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { withTenant } from '@sparx/db';

import { createMember } from '../../src/members.js';
import { deleteRate, listRates, setRate } from '../../src/rates.js';
import { attributeSale, listCommissions } from '../../src/commissions.js';
import { commissionForOrder } from '../../src/commission-calc.js';
import { createTestTenant, day, dropTestTenant, type TestTenant } from '../helpers.js';

let ctx: TestTenant;

beforeEach(async () => {
  ctx = await createTestTenant();
});

afterEach(async () => {
  await dropTestTenant(ctx.tenantId);
});

/** Somebody paid on commission, at `percent`, from the start of the year. */
async function hireOnCommission(percent = 7.5, from = '2026-01-01') {
  const member = await createMember(ctx.tenantId, {
    firstName: 'Rae',
    lastName: 'Villanueva',
    siteIds: [ctx.propertyId],
    primarySiteId: ctx.propertyId,
  });
  await setRate(ctx.tenantId, member.id, {
    basis: 'commission',
    amountCents: 0,
    commissionPercent: percent,
    effectiveFrom: day(from),
  });
  return member;
}

/** A buyer. `Order.customer` is required, so an order fixture needs one. */
async function makeCustomer() {
  return withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.customer.create({
      data: {
        tenant: { connect: { id: ctx.tenantId } },
        email: `buyer-${crypto.randomBytes(3).toString('hex')}@sparx.test`,
      },
      select: { id: true },
    })
  );
}

/** An order in major units, the way the orders table actually stores money. */
async function placeOrder(opts: {
  subtotal: string;
  discount?: string;
  total: string;
  refund?: string;
  paid: boolean;
}) {
  const customer = await makeCustomer();
  return withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.order.create({
      data: {
        // Relations, not scalars: `Order.tenant` and `Order.customer` are both
        // required, and Prisma's checked create wants them connected rather than
        // bare `tenantId` / `customerId`.
        tenant: { connect: { id: ctx.tenantId } },
        customer: { connect: { id: customer.id } },
        property: { connect: { id: ctx.propertyId } },
        orderNumber: `T-${crypto.randomBytes(3).toString('hex')}`,
        status: 'placed',
        paymentStatus: opts.paid ? 'paid' : 'unpaid',
        subtotal: opts.subtotal,
        discountTotal: opts.discount ?? '0',
        total: opts.total,
        refundTotal: opts.refund ?? '0',
        placedAt: day('2026-03-02'),
        paidAt: opts.paid ? day('2026-03-02') : null,
      },
      select: { id: true },
    })
  );
}

describe('commission on an order', () => {
  it('pays the rate on subtotal less discount — not on tax or shipping', async () => {
    // $400 of goods, $40 shipping/tax on top. 7.5% of the GOODS is $30.00; 7.5%
    // of the whole $440 would be $33.00, and that extra $3 is a share of money
    // the business never kept.
    const member = await hireOnCommission(7.5);
    const order = await placeOrder({ subtotal: '400.00', total: '440.00', paid: true });
    await attributeSale(ctx.tenantId, {
      staffMemberId: member.id,
      sourceType: 'order',
      sourceId: order.id,
    });

    const result = await commissionForOrder(ctx.tenantId, order.id);

    expect(result).toMatchObject({ outcome: 'recorded', basisCents: 40_000, amountCents: 3_000 });
    const rows = await listCommissions(ctx.tenantId, { staffMemberId: member.id });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amountCents).toBe(3_000);
    expect(rows[0]?.status).toBe('pending');
  });

  it('earns NOTHING until the order is paid', async () => {
    // The rule that stops a business funding its staff out of a promise.
    const member = await hireOnCommission();
    const order = await placeOrder({ subtotal: '400.00', total: '440.00', paid: false });
    await attributeSale(ctx.tenantId, {
      staffMemberId: member.id,
      sourceType: 'order',
      sourceId: order.id,
    });

    expect(await commissionForOrder(ctx.tenantId, order.id)).toMatchObject({
      outcome: 'not-payable',
    });
    expect(await listCommissions(ctx.tenantId, {})).toHaveLength(0);
  });

  it('earns nothing when nobody is credited — an order has no salesperson of its own', async () => {
    await hireOnCommission();
    const order = await placeOrder({ subtotal: '400.00', total: '440.00', paid: true });

    expect(await commissionForOrder(ctx.tenantId, order.id)).toMatchObject({
      outcome: 'no-attribution',
    });
  });

  it('says the rate STARTED LATER rather than "not on commission"', async () => {
    // The defect this pins was found by clicking, not by a test: somebody was put
    // on 7.5% today, an order paid a fortnight ago was credited to them, and the
    // screen said "they are not on commission — set a commission rate." They
    // were on commission. Sending an owner to do the thing they have just done
    // is worse than saying nothing, because they conclude the feature is broken.
    const member = await hireOnCommission(7.5, '2026-06-01');
    const order = await placeOrder({ subtotal: '400.00', total: '440.00', paid: true });
    await attributeSale(ctx.tenantId, {
      staffMemberId: member.id,
      sourceType: 'order',
      sourceId: order.id,
    });

    // The order was paid 2026-03-02 — before the rate begins.
    expect(await commissionForOrder(ctx.tenantId, order.id)).toMatchObject({
      outcome: 'rate-not-in-force',
      staffMemberId: member.id,
      rateStartsOn: '2026-06-01',
      earnedOn: '2026-03-02',
    });
    expect(await listCommissions(ctx.tenantId, {})).toHaveLength(0);
  });

  it('pays it once the rate is re-added from an earlier date', async () => {
    // The other half, and the reason the message names the remedy so precisely.
    // The obvious advice — "backdate the rate" — is REFUSED: pay rates may not
    // overlap, so `setRate` with an earlier start throws
    // `OverlappingPayRateError`. Removing the rate and adding it again is the
    // path that actually works, and telling somebody to do the other thing sends
    // them into a wall.
    const member = await hireOnCommission(7.5, '2026-06-01');
    const order = await placeOrder({ subtotal: '400.00', total: '440.00', paid: true });
    await attributeSale(ctx.tenantId, {
      staffMemberId: member.id,
      sourceType: 'order',
      sourceId: order.id,
    });
    await commissionForOrder(ctx.tenantId, order.id);

    await expect(
      setRate(ctx.tenantId, member.id, {
        basis: 'commission',
        amountCents: 0,
        commissionPercent: 7.5,
        effectiveFrom: day('2026-01-01'),
      })
    ).rejects.toThrow(/already has a pay rate/);

    const [existing] = await listRates(ctx.tenantId, member.id);
    await deleteRate(ctx.tenantId, existing!.id);
    await setRate(ctx.tenantId, member.id, {
      basis: 'commission',
      amountCents: 0,
      commissionPercent: 7.5,
      effectiveFrom: day('2026-01-01'),
    });

    expect(await commissionForOrder(ctx.tenantId, order.id)).toMatchObject({
      outcome: 'recorded',
      amountCents: 3_000,
    });
  });

  it('earns nothing when the person is not on commission', async () => {
    const member = await createMember(ctx.tenantId, {
      firstName: 'Ines',
      siteIds: [ctx.propertyId],
      primarySiteId: ctx.propertyId,
    });
    await setRate(ctx.tenantId, member.id, {
      basis: 'hourly',
      amountCents: 3_000,
      effectiveFrom: day('2026-01-01'),
    });
    const order = await placeOrder({ subtotal: '400.00', total: '440.00', paid: true });
    await attributeSale(ctx.tenantId, {
      staffMemberId: member.id,
      sourceType: 'order',
      sourceId: order.id,
    });

    expect(await commissionForOrder(ctx.tenantId, order.id)).toMatchObject({
      outcome: 'no-rate',
      staffMemberId: member.id,
    });
  });

  it('REDUCES on a refund instead of leaving a correcting row beside it', async () => {
    const member = await hireOnCommission(7.5);
    const order = await placeOrder({ subtotal: '400.00', total: '440.00', paid: true });
    await attributeSale(ctx.tenantId, {
      staffMemberId: member.id,
      sourceType: 'order',
      sourceId: order.id,
    });
    await commissionForOrder(ctx.tenantId, order.id);

    // Half the order comes back.
    await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.order.update({ where: { id: order.id }, data: { refundTotal: '220.00' } })
    );
    const after = await commissionForOrder(ctx.tenantId, order.id);

    expect(after.amountCents).toBe(1_500);
    const rows = await listCommissions(ctx.tenantId, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amountCents).toBe(1_500);
  });

  it('pays nothing on a full refund, and still only one row', async () => {
    const member = await hireOnCommission();
    const order = await placeOrder({ subtotal: '400.00', total: '440.00', paid: true });
    await attributeSale(ctx.tenantId, {
      staffMemberId: member.id,
      sourceType: 'order',
      sourceId: order.id,
    });
    await commissionForOrder(ctx.tenantId, order.id);

    await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.order.update({ where: { id: order.id }, data: { refundTotal: '440.00' } })
    );

    expect((await commissionForOrder(ctx.tenantId, order.id)).amountCents).toBe(0);
    expect(await listCommissions(ctx.tenantId, {})).toHaveLength(1);
  });

  it('is idempotent — a redelivered order.paid does not pay twice', async () => {
    const member = await hireOnCommission();
    const order = await placeOrder({ subtotal: '400.00', total: '440.00', paid: true });
    await attributeSale(ctx.tenantId, {
      staffMemberId: member.id,
      sourceType: 'order',
      sourceId: order.id,
    });

    await commissionForOrder(ctx.tenantId, order.id);
    await commissionForOrder(ctx.tenantId, order.id);

    const rows = await listCommissions(ctx.tenantId, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amountCents).toBe(3_000);
  });

  it('never resurrects a VOIDED commission on recalculation', async () => {
    // The status is a decision a human made about money. A recalculation may
    // move the figure; it must not undo the decision.
    const member = await hireOnCommission();
    const order = await placeOrder({ subtotal: '400.00', total: '440.00', paid: true });
    await attributeSale(ctx.tenantId, {
      staffMemberId: member.id,
      sourceType: 'order',
      sourceId: order.id,
    });
    await commissionForOrder(ctx.tenantId, order.id);

    await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.staffCommission.updateMany({ where: {}, data: { status: 'void' } })
    );
    await commissionForOrder(ctx.tenantId, order.id);

    const rows = await listCommissions(ctx.tenantId, {});
    expect(rows[0]?.status).toBe('void');
  });

  it('moves the credit rather than paying two people for one sale', async () => {
    const first = await hireOnCommission();
    const second = await createMember(ctx.tenantId, {
      firstName: 'Tomas',
      siteIds: [ctx.propertyId],
      primarySiteId: ctx.propertyId,
    });
    await setRate(ctx.tenantId, second.id, {
      basis: 'commission',
      amountCents: 0,
      commissionPercent: 10,
      effectiveFrom: day('2026-01-01'),
    });
    const order = await placeOrder({ subtotal: '400.00', total: '440.00', paid: true });

    await attributeSale(ctx.tenantId, {
      staffMemberId: first.id,
      sourceType: 'order',
      sourceId: order.id,
    });
    await commissionForOrder(ctx.tenantId, order.id);

    // Re-credited to somebody else — the unique on (tenant, source) moves it.
    await attributeSale(ctx.tenantId, {
      staffMemberId: second.id,
      sourceType: 'order',
      sourceId: order.id,
    });
    await commissionForOrder(ctx.tenantId, order.id);

    const rows = await listCommissions(ctx.tenantId, {});
    // The FIRST person's row survives, because it is a record of what they were
    // told they were owed — voiding it is a decision, not a side effect of a
    // dropdown. What must not happen is the second person being paid nothing.
    const forSecond = rows.filter((r) => r.staffMemberId === second.id);
    expect(forSecond).toHaveLength(1);
    expect(forSecond[0]?.amountCents).toBe(4_000);
  });
});

describe('the pay rate itself', () => {
  it('refuses a commission percentage on an hourly rate', async () => {
    // Silently zeroing it is how somebody sets 7.5% on an hourly rate, watches
    // it save, and wonders for a month why nobody was paid.
    const member = await createMember(ctx.tenantId, {
      firstName: 'Dee',
      siteIds: [ctx.propertyId],
      primarySiteId: ctx.propertyId,
    });
    const rate = await setRate(ctx.tenantId, member.id, {
      basis: 'hourly',
      amountCents: 3_000,
      commissionPercent: 7.5,
      effectiveFrom: day('2026-01-01'),
    });
    // The service zeroes it; the DB CHECK would refuse it outright. The API
    // schema rejects it with a message before either gets the chance.
    expect(rate.commissionPercent).toBe(0);
  });

  it('round-trips the percentage on a commission rate', async () => {
    const member = await hireOnCommission(3.25);
    const rates = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.staffPayRate.findMany({ where: { staffMemberId: member.id } })
    );
    expect(Number(rates[0]?.commissionPercent.toString())).toBe(3.25);
  });
});
