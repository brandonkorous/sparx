// The tracking poll, against real Postgres + RLS with a FAKE supplier.
//
// `getTrackingUpdate()` was implemented by all four adapters and called by
// nothing, so this whole path shipped inert. Firing the endpoint by hand proved
// it answers — but with two `failed` rows in the entire database it polled
// nothing, and a sweep that checks zero orders looks identical whether the
// filter is right or wrong. These tests are the part that could not be proven
// by running it.
//
// What they pin, in order of what actually costs a customer something:
//   • publish on a TRANSITION only — the same "it shipped" email must not go out
//     on every sweep for three days;
//   • poll only what is in flight — a delivered row is finished and a failed one
//     needs a human;
//   • one unreachable supplier records its error and the sweep carries on.

import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupplierAdapter, TrackingInfo } from '@sparx/dropship';
import { withTenant } from '@sparx/db';

import { pollDropshipTracking } from '../../src/lib/dropship-tracking.js';
import { createTestTenant, dropTestTenant, type TestTenant } from '../helpers.js';

let t: TestTenant;

beforeEach(async () => {
  t = await createTestTenant('owner');
});

afterEach(async () => {
  await dropTestTenant(t.tenantId);
});

/** Every published event, in order. The poll's whole contract with the outside
 *  world is which of these fire and how often. */
interface Published {
  type: string;
  data: Record<string, unknown>;
}

function recorder(log: Published[]) {
  return (
    type: string,
    _tenantId: string,
    _actorId: string | null,
    data: Record<string, unknown>
  ) => {
    log.push({ type, data });
    return Promise.resolve();
  };
}

/** A supplier that answers `getTrackingUpdate` from a per-order script. An entry
 *  of `throw` makes that one call fail, which is how a supplier outage looks. */
function fakeSupplier(script: Record<string, TrackingInfo | 'throw'>) {
  return () =>
    ({
      getTrackingUpdate: vi.fn((supplierOrderId: string) => {
        const answer = script[supplierOrderId];
        if (!answer || answer === 'throw') {
          return Promise.reject(new Error(`supplier unreachable: ${supplierOrderId}`));
        }
        return Promise.resolve(answer);
      }),
    }) as unknown as SupplierAdapter;
}

function tracking(status: TrackingInfo['status'], over: Partial<TrackingInfo> = {}): TrackingInfo {
  return {
    supplierOrderId: 'SUP-1',
    trackingNumber: null,
    trackingUrl: null,
    carrier: null,
    status,
    events: [],
    ...over,
  };
}

async function seedSupplier(): Promise<string> {
  const row = await withTenant({ tenantId: t.tenantId }, (tx) =>
    tx.dropshipSupplier.create({
      data: { tenantId: t.tenantId, name: 'Fake Supplier', type: 'printful', status: 'active' },
      select: { id: true },
    })
  );
  return row.id;
}

/** A dropship row needs a real order behind it — `order_id` is an FK, and an
 *  order needs a customer and a site. */
async function seedDropshipOrder(opts: {
  supplierId: string;
  status: string;
  supplierOrderId: string | null;
  trackingNumber?: string | null;
  errorMessage?: string | null;
}): Promise<string> {
  return withTenant({ tenantId: t.tenantId }, async (tx) => {
    const customer = await tx.customer.create({
      data: {
        tenant: { connect: { id: t.tenantId } },
        email: `buyer-${crypto.randomBytes(3).toString('hex')}@sparx.test`,
      },
      select: { id: true },
    });
    const order = await tx.order.create({
      data: {
        tenant: { connect: { id: t.tenantId } },
        customer: { connect: { id: customer.id } },
        property: { connect: { id: t.propertyId } },
        orderNumber: `D-${crypto.randomBytes(3).toString('hex')}`,
        status: 'placed',
        paymentStatus: 'paid',
        subtotal: '50.00',
        total: '50.00',
        placedAt: new Date('2026-03-02T00:00:00.000Z'),
      },
      select: { id: true },
    });
    const row = await tx.dropshipOrder.create({
      data: {
        tenantId: t.tenantId,
        orderId: order.id,
        supplierId: opts.supplierId,
        supplierOrderId: opts.supplierOrderId,
        status: opts.status,
        trackingNumber: opts.trackingNumber ?? null,
        errorMessage: opts.errorMessage ?? null,
      },
      select: { id: true },
    });
    return row.id;
  });
}

function readRow(id: string) {
  return withTenant({ tenantId: t.tenantId }, (tx) =>
    tx.dropshipOrder.findUniqueOrThrow({ where: { id } })
  );
}

describe('what the poll asks about', () => {
  it('asks only about orders in flight that have a supplier order id', async () => {
    const supplierId = await seedSupplier();
    await seedDropshipOrder({ supplierId, status: 'pending', supplierOrderId: 'SUP-PENDING' });
    await seedDropshipOrder({ supplierId, status: 'delivered', supplierOrderId: 'SUP-DONE' });
    await seedDropshipOrder({ supplierId, status: 'failed', supplierOrderId: 'SUP-FAILED' });
    // Submitted, but the supplier never gave us an id to ask about.
    await seedDropshipOrder({ supplierId, status: 'submitted', supplierOrderId: null });
    const live = await seedDropshipOrder({
      supplierId,
      status: 'submitted',
      supplierOrderId: 'SUP-LIVE',
    });

    const asked: string[] = [];
    const result = await pollDropshipTracking(t.tenantId, {
      makeAdapter: () =>
        ({
          getTrackingUpdate: (id: string) => {
            asked.push(id);
            return Promise.resolve(tracking('pending'));
          },
        }) as unknown as SupplierAdapter,
      publish: recorder([]),
    });

    expect(asked).toEqual(['SUP-LIVE']);
    expect(result.checked).toBe(1);
    // And the one it did ask about is untouched, because nothing moved.
    expect((await readRow(live)).status).toBe('submitted');
  });
});

describe('a parcel that moves', () => {
  it('records the shipment and says so exactly once', async () => {
    const supplierId = await seedSupplier();
    const id = await seedDropshipOrder({
      supplierId,
      status: 'submitted',
      supplierOrderId: 'SUP-1',
    });
    const info = tracking('shipped', {
      trackingNumber: '1Z999',
      trackingUrl: 'https://track.test/1Z999',
      carrier: 'UPS',
    });
    const log: Published[] = [];
    const deps = { makeAdapter: fakeSupplier({ 'SUP-1': info }), publish: recorder(log) };

    const first = await pollDropshipTracking(t.tenantId, deps);

    expect(first).toMatchObject({ checked: 1, shipped: 1, delivered: 0, failed: 0 });
    const row = await readRow(id);
    expect(row.status).toBe('shipped');
    expect(row.trackingNumber).toBe('1Z999');
    expect(row.trackingUrl).toBe('https://track.test/1Z999');
    expect(row.shippedAt).not.toBeNull();
    expect(log).toHaveLength(1);
    expect(log[0]?.type).toBe('dropship.order.shipped');
    expect(log[0]?.data).toMatchObject({ trackingNumber: '1Z999', carrier: 'UPS' });

    // The sweep runs hourly. The supplier still says "shipped" tomorrow, and the
    // customer must NOT be told again — this is the rule that makes the event
    // usable as an automation trigger at all.
    const second = await pollDropshipTracking(t.tenantId, deps);

    expect(second).toMatchObject({ checked: 1, shipped: 0 });
    expect(log).toHaveLength(1);
  });

  it('treats in_transit as shipped — it left, which is the transition we model', async () => {
    const supplierId = await seedSupplier();
    const id = await seedDropshipOrder({
      supplierId,
      status: 'submitted',
      supplierOrderId: 'SUP-1',
    });
    const log: Published[] = [];

    await pollDropshipTracking(t.tenantId, {
      makeAdapter: fakeSupplier({ 'SUP-1': tracking('in_transit', { trackingNumber: 'IN-1' }) }),
      publish: recorder(log),
    });

    expect((await readRow(id)).status).toBe('shipped');
    expect(log.map((e) => e.type)).toEqual(['dropship.order.shipped']);
  });

  it('closes it out on delivery and clears a stale transport error', async () => {
    const supplierId = await seedSupplier();
    const id = await seedDropshipOrder({
      supplierId,
      status: 'shipped',
      supplierOrderId: 'SUP-1',
      trackingNumber: '1Z999',
      errorMessage: 'supplier unreachable: SUP-1',
    });
    const log: Published[] = [];

    const result = await pollDropshipTracking(t.tenantId, {
      makeAdapter: fakeSupplier({ 'SUP-1': tracking('delivered', { trackingNumber: '1Z999' }) }),
      publish: recorder(log),
    });

    expect(result).toMatchObject({ checked: 1, shipped: 0, delivered: 1 });
    const row = await readRow(id);
    expect(row.status).toBe('delivered');
    expect(row.deliveredAt).not.toBeNull();
    expect(row.errorMessage).toBeNull();
    expect(log.map((e) => e.type)).toEqual(['dropship.order.delivered']);
  });
});

describe('a parcel that does not move', () => {
  it('saves a tracking number that arrives before the status does, and stays quiet', async () => {
    // A supplier commonly issues the label first. That number is worth having —
    // the customer can use it — but nothing has shipped, so nothing is announced.
    const supplierId = await seedSupplier();
    const id = await seedDropshipOrder({
      supplierId,
      status: 'submitted',
      supplierOrderId: 'SUP-1',
    });
    const log: Published[] = [];

    await pollDropshipTracking(t.tenantId, {
      makeAdapter: fakeSupplier({ 'SUP-1': tracking('pending', { trackingNumber: 'LABEL-1' }) }),
      publish: recorder(log),
    });

    const row = await readRow(id);
    expect(row.trackingNumber).toBe('LABEL-1');
    expect(row.status).toBe('submitted');
    expect(log).toHaveLength(0);
  });

  it('does NOT call a customs hold a failed order', async () => {
    // `failed` means the supplier never accepted the order — a human has to
    // resubmit it. An exception in transit is a different problem entirely, and
    // moving the row there would take it out of the poll for good.
    const supplierId = await seedSupplier();
    const id = await seedDropshipOrder({
      supplierId,
      status: 'shipped',
      supplierOrderId: 'SUP-1',
    });
    const log: Published[] = [];

    const result = await pollDropshipTracking(t.tenantId, {
      makeAdapter: fakeSupplier({ 'SUP-1': tracking('exception') }),
      publish: recorder(log),
    });

    expect((await readRow(id)).status).toBe('shipped');
    expect(result.failed).toBe(0);
    expect(log).toHaveLength(0);
  });
});

describe('a supplier that is down', () => {
  it('records the error on that order and keeps checking the rest', async () => {
    const supplierId = await seedSupplier();
    const broken = await seedDropshipOrder({
      supplierId,
      status: 'submitted',
      supplierOrderId: 'SUP-DOWN',
    });
    const fine = await seedDropshipOrder({
      supplierId,
      status: 'submitted',
      supplierOrderId: 'SUP-OK',
    });
    const log: Published[] = [];

    const result = await pollDropshipTracking(t.tenantId, {
      makeAdapter: fakeSupplier({
        'SUP-DOWN': 'throw',
        'SUP-OK': tracking('shipped', { trackingNumber: 'OK-1' }),
      }),
      publish: recorder(log),
    });

    expect(result).toMatchObject({ checked: 2, failed: 1, shipped: 1 });
    expect((await readRow(broken)).errorMessage).toContain('supplier unreachable');
    // The failure did not cost the other order its update.
    expect((await readRow(fine)).status).toBe('shipped');
    expect(log.map((e) => e.type)).toEqual(['dropship.order.shipped']);
  });
});
