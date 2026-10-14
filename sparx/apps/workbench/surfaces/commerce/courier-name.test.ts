// Doty could not name the courier when he marked an order sent (sparx persona
// issue 219). "Another courier" asked nothing more, so the customer read "Another
// courier" beside a tracking number for nobody in particular.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { serviceFor } from './carriers';

const read = (file: string) => readFileSync(resolve(__dirname, file), 'utf8');

describe('marking an order sent with a courier sparx has no code for', () => {
  const form = read('./record-handover.tsx');
  const hook = read('./data.ts');

  it('asks for the courier by name', () => {
    expect(form).toContain("=== 'other'");
    expect(form).toContain('Courier’s name');
  });

  it('sends the name with the shipment', () => {
    expect(form).toMatch(/carrierOther:/);
    expect(hook).toMatch(/carrierOther: input\.carrierOther/);
  });
});

// Sent with a local courier, though the shopper chose UPS Ground: the shipment read
// "Salt Lake Courier · UPS Ground", two carriers for one parcel.
describe('the service kept on a shipment', () => {
  it('is the chosen one when that carrier took it', () => {
    expect(serviceFor('UPS Ground', 'ups')).toBe('UPS Ground');
  });

  it('is dropped when another carrier took it', () => {
    expect(serviceFor('UPS Ground', 'other')).toBeUndefined();
    expect(serviceFor('UPS Ground', 'usps')).toBeUndefined();
    expect(serviceFor('USPS Priority', 'ups')).toBeUndefined();
  });

  it('is sent only through this rule', () => {
    expect(read('./record-handover.tsx')).toMatch(/serviceFor\(plan\.description/);
  });
});
