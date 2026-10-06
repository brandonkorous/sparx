import { describe, expect, it } from 'vitest';
import type { VariantChoice } from '../commerce/bundles-data';
import {
  lineDescription,
  linkedProductBadge,
  pickFrom,
  pickable,
  pickerRowFor,
} from './product-pick';

/**
 * WHAT A PICKED PART PUTS ON A QUOTE LINE (sparx persona issue 077).
 *
 * Gillett names its parts with the code in the name, so the line used to read
 * "Bosch Remanufactured Fuel Injector (0986435621) (0986435621)".
 */

function variant(overrides: Partial<VariantChoice> = {}): VariantChoice {
  return {
    id: '6f0cf3c9-2fc3-4294-a285-643eb5ef229d',
    sku: '0986435621',
    title: null,
    options: [],
    isDefault: true,
    priceCents: 60000,
    currency: 'USD',
    coreChargeCents: 15000,
    coreFirstOffered: true,
    archivedAt: null,
    productId: '2db1efc0-fd08-46b4-ac1d-6f334d426077',
    productTitle: 'Bosch Remanufactured Fuel Injector (0986435621)',
    productHandle: 'bosch-0986435621-remanufactured-fuel-injector',
    productStatus: 'active',
    ...overrides,
  } as VariantChoice;
}

describe('lineDescription', () => {
  it('never repeats a code the name already carries', () => {
    expect(lineDescription(variant())).toBe('Bosch Remanufactured Fuel Injector (0986435621)');
  });

  it('adds the code when the name does not carry it', () => {
    expect(
      lineDescription(variant({ productTitle: 'FPPF Total Power Fuel Treatment', sku: '90343' }))
    ).toBe('FPPF Total Power Fuel Treatment (90343)');
  });

  it("adds the version's own name, which is what tells two versions apart", () => {
    expect(
      lineDescription(
        variant({
          productTitle: 'Shop towels',
          sku: 'TOW-12',
          title: 'Case of 12',
          isDefault: false,
        })
      )
    ).toBe('Shop towels (Case of 12, TOW-12)');
  });

  it('names a version by its options when it has no name of its own', () => {
    expect(
      lineDescription(
        variant({
          productTitle: 'The Ash Overshirt',
          sku: 'ASH-M-SLATE',
          options: [
            { name: 'Size', value: 'M' },
            { name: 'Color', value: 'Slate' },
          ],
        })
      )
    ).toBe('The Ash Overshirt (M · Slate, ASH-M-SLATE)');
  });
});

describe('pickerRowFor', () => {
  it('reads name first, then the code only when the name lacks it, then the price', () => {
    expect(pickerRowFor(variant())).toEqual({
      id: '6f0cf3c9-2fc3-4294-a285-643eb5ef229d',
      primary: 'Bosch Remanufactured Fuel Injector (0986435621)',
      secondary: '$600.00',
      mark: null,
    });
    expect(
      pickerRowFor(
        variant({ productTitle: 'FPPF Total Power Fuel Treatment', sku: '90343', priceCents: 2299 })
      ).secondary
    ).toBe('90343 · $22.99');
  });

  it('marks a product that is not on sale', () => {
    expect(pickerRowFor(variant({ productStatus: 'draft' })).mark).toEqual({
      label: 'Not on sale',
      color: 'info',
    });
  });
});

describe('pickFrom', () => {
  it('seeds the list price and the core deposit in dollars', () => {
    expect(pickFrom(variant())).toEqual({
      productId: '2db1efc0-fd08-46b4-ac1d-6f334d426077',
      variantId: '6f0cf3c9-2fc3-4294-a285-643eb5ef229d',
      description: 'Bosch Remanufactured Fuel Injector (0986435621)',
      unitPrice: 600,
      coreCharge: 150,
      costCents: null,
    });
  });

  // The cost basis comes with the part, so its margin shows at once (issue 086).
  it('brings what the part costs you, in cents', () => {
    expect(pickFrom(variant({ costCents: 41250 })).costCents).toBe(41250);
  });

  it('brings no cost for a part with none on record, never 0', () => {
    expect(pickFrom(variant({ costCents: null })).costCents).toBeNull();
  });
});

describe('pickable', () => {
  it('keeps retired products off a new line', () => {
    expect(pickable(variant({ productStatus: 'archived' }))).toBe(false);
    expect(pickable(variant({ archivedAt: '2026-10-02T03:18:13.751Z' }))).toBe(false);
    expect(pickable(variant())).toBe(true);
  });
});

describe('linkedProductBadge', () => {
  const name = 'Bosch Remanufactured Fuel Injector (0986435621)';
  const id = '2db1efc0-fd08-46b4-ac1d-6f334d426077';

  it('says nothing when the description is already the product name', () => {
    expect(linkedProductBadge({ productId: id, productLabel: name, description: name })).toBeNull();
  });

  it('names the product when the description was changed', () => {
    expect(
      linkedProductBadge({
        productId: id,
        productLabel: name,
        description: 'Injectors for unit 14',
      })
    ).toBe(name);
  });

  it('marks a link whose product name has not loaded, and nothing on a typed line', () => {
    expect(linkedProductBadge({ productId: id, productLabel: null, description: name })).toBe(
      'Linked product'
    );
    expect(
      linkedProductBadge({ productId: null, productLabel: null, description: 'Labor' })
    ).toBeNull();
  });
});
