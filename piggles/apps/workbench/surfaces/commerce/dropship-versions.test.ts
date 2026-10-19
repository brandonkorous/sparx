// Sparx persona issue 362: one supplier code for two versions of a part.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { startingRows, versionsToSend } from './dropship-versions';
import type { ProductDropshipVariant } from './products-data';

const variants: ProductDropshipVariant[] = [
  {
    id: 'oiled',
    sku: '75-5094',
    title: null,
    priceCents: 37900,
    costCents: null,
    currency: 'USD',
    dropshipSourceId: null,
    supplierSku: null,
  },
  {
    id: 'dry',
    sku: '75-5094D',
    title: 'Dry filter',
    priceCents: 37900,
    costCents: 26200,
    currency: 'USD',
    dropshipSourceId: 'sb',
    supplierSku: '75-5094-DRY',
  },
];

describe('startingRows', () => {
  it('starts each version on the code and cost it already has', () => {
    expect(startingRows(variants, 25000)).toEqual([
      { variantId: 'oiled', label: '75-5094', code: '75-5094', cost: '250.00' },
      { variantId: 'dry', label: 'Dry filter', code: '75-5094-DRY', cost: '262.00' },
    ]);
  });
});

describe('versionsToSend', () => {
  it('sends each version with its own code and price', () => {
    expect(versionsToSend(startingRows(variants, 25000))).toEqual({
      versions: [
        { variantId: 'oiled', supplierSku: '75-5094', costCents: 25000 },
        { variantId: 'dry', supplierSku: '75-5094-DRY', costCents: 26200 },
      ],
    });
  });

  it('names the version that is missing something', () => {
    const rows = startingRows(variants, null);
    expect(versionsToSend(rows)).toEqual({
      problem: 'Say what they charge you for 75-5094, like 250.00.',
    });
    expect(versionsToSend([{ ...rows[1]!, code: ' ' }])).toEqual({
      problem: 'Give their code for Dry filter.',
    });
  });
});

describe('the ship-from-supplier form', () => {
  it('asks version by version when there is more than one', () => {
    const form = readFileSync(
      fileURLToPath(new URL('./product-dropship-link-form.tsx', import.meta.url)),
      'utf8'
    );
    expect(form).toContain('startingRows(');
    expect(form).toContain('versionsToSend(');
  });
});
