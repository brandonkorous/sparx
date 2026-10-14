// A supplier invoice or return with nothing to pick says so and offers the way
// forward (sparx persona issue 252), not an empty picker and "Choose an order".

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8');

describe('nothing to pick', () => {
  it('an invoice with no placed order offers a new order', () => {
    expect(read('use-supplier-bill-draft.ts')).toMatch(
      /nothingPlaced: orders\.isSuccess && billable\.length === 0/
    );
    expect(read('supplier-bill-new-sections.tsx')).toMatch(
      /ctx\.open\('inventory\.purchase-orders\.detail', \{ id: 'new' \}/
    );
  });

  it('a return with no supplier offers to add one', () => {
    const source = read('supplier-return-new.tsx');
    expect(source).toMatch(
      /suppliers\.isSuccess && \(form\.suppliers\.data\?\.items \?\? \[\]\)\.length === 0/
    );
    expect(source).toMatch(/ctx\.open\('inventory\.suppliers\.detail', \{ id: 'new' \}/);
  });
});
