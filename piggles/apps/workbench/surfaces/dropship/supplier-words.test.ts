// Sparx persona issue 364: "has not gone to Bluffdale Bolt Co..", and a CSV
// feed promised orders "can be routed to it".

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { supplierState } from './dropship-data';

describe('a CSV feed supplier', () => {
  it('says its orders wait for the owner, never that they go to it', () => {
    const detail = supplierState('active', 'csv').detail;
    expect(detail).toContain('wait for you to place them yourself');
    expect(detail).not.toContain('routed');
  });
});

describe('a supplier order not placed yet', () => {
  it('never ends a sentence on the supplier name', () => {
    const pane = readFileSync(
      fileURLToPath(new URL('./order-detail.tsx', import.meta.url)),
      'utf8'
    );
    expect(pane).not.toContain('has not gone to ${who}.');
    expect(pane).toContain('${who} does not have this order yet.');
  });
});
