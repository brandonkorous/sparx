// How an order reaches the customer, as timeline steps (sparx persona issues 177, 218).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { handoverSteps } from './order-handover';

const here = fileURLToPath(new URL('.', import.meta.url));
const live = { collecting: false, fulfilledAt: null, deliveredAt: null };

describe('handoverSteps', () => {
  it('reads On its way, then Delivered, for an order still to ship', () => {
    expect(handoverSteps(live, false).map((s) => [s.label, s.complete])).toEqual([
      ['On its way', false],
      ['Delivered', false],
    ]);
  });

  // S&B shipped the kit, Gillett had not yet shipped the additive (issue 218).
  it('says part of it is on its way when one shipment of several has left', () => {
    const [shipped] = handoverSteps({ ...live, partlyShipped: true }, false);
    expect(shipped).toMatchObject({ label: 'Part of it is on its way', complete: false });
  });

  it('says On its way once all of it has', () => {
    const [shipped] = handoverSteps(
      { ...live, fulfilledAt: '2026-10-11T07:52:23Z', partlyShipped: true },
      false
    );
    expect(shipped).toMatchObject({ label: 'On its way', complete: true });
  });

  it('gives a collected order one step', () => {
    expect(handoverSteps({ ...live, collecting: true }, false).map((s) => s.label)).toEqual([
      'Collected',
    ]);
  });
});

describe('the timeline', () => {
  const timeline = readFileSync(join(here, '..', 'components', 'order-timeline.tsx'), 'utf8');

  it('shows a shipment that has left, whether or not the rest has', () => {
    expect(timeline).toContain('partlyShipped: shipments.length > 0');
    expect(timeline).not.toContain('handover.complete && shipments.length > 0');
  });
});
