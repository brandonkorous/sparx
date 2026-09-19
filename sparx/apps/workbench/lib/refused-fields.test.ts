// A REFUSED SAVE HAS TO NAME A BOX.
//
// Measured 2026-09-17: 83 call sites in this console and 86 in sparx hand an
// error to `apiErrorMessage`, and not one of them read the field list that came
// back with it. So a twenty-field form said "Nothing was changed." and left
// every box on the screen a suspect.

import { describe, expect, it } from 'vitest';

import { fieldLabel, refusedFields, refusedWhat } from './refused-fields';

/** What Zod 4 actually sends, through the errors plugin. */
function zod(path: string, message = 'Invalid input'): Record<string, unknown> {
  return { path, field: path, message, code: 'invalid_type' };
}

describe('the name that is read', () => {
  it('turns a camelCase field into words', () => {
    expect(fieldLabel('physicalAddress')).toBe('Physical address');
  });

  it('turns an under_scored field into the same words', () => {
    expect(fieldLabel('physical_address')).toBe('Physical address');
  });

  it('drops the part that names the request, not the box', () => {
    // There is no "body" on the screen.
    expect(fieldLabel('body.price')).toBe('Price');
    expect(fieldLabel('query.q')).toBe('Q');
  });

  it('counts rows from one, the way they are counted on screen', () => {
    expect(fieldLabel('items.2.quantity')).toBe('Quantity (item 3)');
  });

  it('reads a Fastify pointer the same way', () => {
    expect(fieldLabel('/items/0/unitPrice')).toBe('Unit price (item 1)');
  });
});

describe('when there is no box to point at', () => {
  it('says nothing for a rule that refused the whole request', () => {
    // An empty path means the object as a whole was wrong. Inventing a field
    // here would point at a box that is fine.
    expect(fieldLabel('')).toBe(null);
    expect(refusedWhat([zod('')])).toBe(null);
  });

  it('says nothing when the refusal is a whole row', () => {
    // `items.2` is row three, not a box inside it.
    expect(fieldLabel('items.2')).toBe(null);
  });

  it('says nothing when details is not a list', () => {
    for (const details of [null, undefined, 'boom', { field: 'price' }, []]) {
      expect(refusedWhat(details), JSON.stringify(details) ?? 'undefined').toBe(null);
    }
  });
});

describe('the sentence', () => {
  it('names one box', () => {
    expect(refusedWhat([zod('physicalAddress')])).toBe('The problem is with Physical address.');
  });

  it('joins two with and, not a comma', () => {
    expect(refusedWhat([zod('physicalAddress'), zod('phone')])).toBe(
      'The problem is with Physical address and Phone.'
    );
  });

  it('joins three with commas and a final and', () => {
    expect(refusedWhat([zod('title'), zod('price'), zod('weight')])).toBe(
      'The problem is with Title, Price and Weight.'
    );
  });

  it('counts the ones it has no room for', () => {
    const many = ['title', 'price', 'weight', 'sku', 'barcode'].map((p) => zod(p));
    expect(refusedWhat(many)).toBe('The problem is with Title, Price, Weight and 2 more.');
  });

  it('names a box once however many times the server refused it', () => {
    expect(refusedFields([zod('price', 'too small'), zod('price', 'not a number')])).toEqual([
      'Price',
    ]);
  });
});

describe('it never repeats the schema talking about itself', () => {
  it('leaves the reason out, whatever the reason was', () => {
    // None of the 142 route files that parse a body attaches its own wording,
    // so every message here is Zod's own: "Invalid input: expected string,
    // received undefined". Repeating that puts the fault back on the person in a
    // vocabulary they have no use for, which is the thing this whole file exists
    // to stop. If a reason ever appears in the output, this goes red.
    const said = refusedWhat([
      zod('price', 'Invalid input: expected number, received string'),
      zod('sku', 'Too small: expected string to have >=1 characters'),
    ]);
    expect(said).not.toMatch(/expected|received|Invalid input|characters|uuid/i);
    expect(said).toBe('The problem is with Price and Sku.');
  });
});
