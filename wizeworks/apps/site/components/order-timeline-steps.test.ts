import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { handoverSteps } from '../lib/order-handover';

// A sale taken at the counter, or an order the customer collects, did not travel.
// Brynn's O-000001 read "Order placed · Payment confirmed · On its way · pickup ·
// Delivered" over "How you'll get it: Taken at the counter" (sparx persona issue
// 177).

const at = '2026-10-02T03:11:00.000Z';
const HERE = dirname(fileURLToPath(import.meta.url));

describe('how an order reaches the customer', () => {
  it('is one step, Collected, for an order they took', () => {
    const steps = handoverSteps({ collecting: true, fulfilledAt: at, deliveredAt: at }, false);
    expect(steps).toEqual([{ key: 'collected', label: 'Collected', at, complete: true }]);
  });

  it('is still to collect before they have', () => {
    const steps = handoverSteps({ collecting: true, fulfilledAt: null, deliveredAt: null }, false);
    expect(steps).toEqual([{ key: 'collected', label: 'Collected', at: null, complete: false }]);
  });

  it('travels when it is shipped', () => {
    const steps = handoverSteps({ collecting: false, fulfilledAt: at, deliveredAt: null }, false);
    expect(steps.map((s) => [s.label, s.complete])).toEqual([
      ['On its way', true],
      ['Delivered', false],
    ]);
  });

  it('is what the timeline draws', () => {
    const timeline = readFileSync(join(HERE, 'order-timeline.tsx'), 'utf8');
    expect(timeline).toMatch(/handoverSteps\(/);
    expect(timeline).not.toMatch(/label: 'On its way'/);
  });
});
