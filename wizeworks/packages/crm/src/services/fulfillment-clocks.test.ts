import { describe, expect, it } from 'vitest';
import { fulfillmentClocks } from './order-fulfillments-service';

const NOW = new Date('2026-08-21T09:15:00.000Z');

describe('fulfillmentClocks', () => {
  it('stamps BOTH clocks on a handover — it shipped and arrived in one movement', () => {
    const { shippedAt, deliveredAt } = fulfillmentClocks('delivered', undefined, NOW);
    expect(shippedAt).toEqual(NOW);
    expect(deliveredAt).toEqual(NOW);
  });

  it('never leaves a delivered fulfillment with no delivered time — issue #046', () => {
    expect(fulfillmentClocks('delivered', undefined, NOW).deliveredAt).not.toBeNull();
  });

  it('stamps only the despatch clock on something posted — it has not arrived', () => {
    const { shippedAt, deliveredAt } = fulfillmentClocks('shipped', undefined, NOW);
    expect(shippedAt).toEqual(NOW);
    expect(deliveredAt).toBeNull();
  });

  it('stamps neither on anything that has not gone', () => {
    for (const status of ['pending', 'failed', 'cancelled']) {
      expect(fulfillmentClocks(status, undefined, NOW)).toEqual({
        shippedAt: null,
        deliveredAt: null,
      });
    }
  });

  it('lets a backfilled shipment keep its own date rather than today’s', () => {
    const stated = '2026-08-14T11:00:00.000Z';
    expect(fulfillmentClocks('shipped', stated, NOW).shippedAt).toEqual(new Date(stated));
  });

  it('carries a stated date through to the delivered clock too', () => {
    const stated = '2026-08-14T11:00:00.000Z';
    expect(fulfillmentClocks('delivered', stated, NOW).deliveredAt).toEqual(new Date(stated));
  });
});
