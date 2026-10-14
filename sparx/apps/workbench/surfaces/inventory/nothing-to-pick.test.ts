// A supplier invoice or return with nothing to pick says so and offers the way
// forward (persona issue 252), instead of an empty picker and "Choose an order".

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8');

describe('nothing to pick', () => {
  it('an invoice with no placed order offers a new order', () => {
    const source = read('supplier-bill-new.tsx');
    expect(source).toMatch(/orders\.isSuccess && billable\.length === 0/);
    expect(source).toMatch(/ctx\.open\('inventory\.purchase-orders\.detail', \{ id: 'new' \}/);
  });

  it('a return with no supplier offers to add one', () => {
    const source = read('supplier-return-detail.tsx');
    expect(source).toMatch(
      /suppliers\.isSuccess && \(suppliers\.data\?\.items \?\? \[\]\)\.length === 0/
    );
    expect(source).toMatch(/ctx\.open\('inventory\.suppliers\.detail', \{ id: 'new' \}/);
  });
});
