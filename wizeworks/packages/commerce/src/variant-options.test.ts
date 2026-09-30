import { describe, expect, it } from 'vitest';
import { variantOptions, variantVersionLabel } from './variant-options';

const assign = (optionName: string, optionPosition: number, value: string, valuePosition = 0) => ({
  optionValue: {
    value,
    position: valuePosition,
    option: { name: optionName, position: optionPosition },
  },
});

describe('naming a version', () => {
  it('reads the axes in the order the shop authored them', () => {
    // "L · Oat", never "Oat · L", whatever order the join came back in.
    const rows = [assign('Color', 1, 'Oat'), assign('Size', 0, 'L')];
    expect(variantOptions(rows)).toEqual([
      { name: 'Size', value: 'L' },
      { name: 'Color', value: 'Oat' },
    ]);
    expect(variantVersionLabel(variantOptions(rows))).toBe('L · Oat');
  });

  it('orders values within one axis by their own position, not alphabetically', () => {
    // Sizes are the case that makes this matter: XS before S before M.
    const rows = [assign('Size', 0, 'M', 2), assign('Size', 0, 'XS', 0), assign('Size', 0, 'S', 1)];
    expect(variantVersionLabel(variantOptions(rows))).toBe('XS · S · M');
  });

  it('does not reorder the caller’s array', () => {
    const first = assign('Color', 1, 'Oat');
    const rows = [first, assign('Size', 0, 'L')];
    variantOptions(rows);
    expect(rows[0]).toBe(first);
  });

  it('gives an EMPTY label for a product that comes one way', () => {
    // A silk scarf has no version to name. Printing its SKU there instead
    // tells the reader nothing they wanted.
    expect(variantOptions([])).toEqual([]);
    expect(variantVersionLabel([])).toBe('');
  });
});
