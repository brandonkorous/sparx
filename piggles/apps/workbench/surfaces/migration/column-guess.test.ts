// A COLUMN LABEL ON THIS SCREEN IS ALSO A LOOKUP KEY.
//
// `guessMapping` matches a heading from somebody's spreadsheet three ways: the
// field's key, the field's LABEL, and the alias list. So the words on the screen
// are not only read, they are matched against — and renaming one quietly changes
// what auto-fills on an import.
//
// That is exactly what happened here. The platform called this one field four
// different things: "Postal code" on fourteen screens, "Postcode" on the import
// mapper and the CSV error message, "Postcode or ZIP" on the stock location form,
// and "ZIP" once. Devi's checkout said "Postal code" to her customers while her
// own import screen said "Postcode" to her (issue 854). Settling on one word
// moved two labels that were being matched against.
//
// So these hold the OLD spellings as well as the new ones. A shop owner whose
// spreadsheet is headed "Postcode" gets the same auto-fill she got yesterday.
// [[feedback_copy_edit_breaks_identity_lookups]]

import { describe, expect, it } from 'vitest';
import { ENTITY_FIELDS } from '@wizeworks/migration';
import { guessMapping } from './column-guess';

describe('the postal code column, after the rename', () => {
  it('matches the new label', () => {
    expect(guessMapping('customers', ['Postal code'])).toEqual({ 'Postal code': 'zip' });
  });

  it('still matches the old label', () => {
    // The word that was on this screen until today. Somebody exported a file
    // yesterday; it has to keep working.
    expect(guessMapping('customers', ['Postcode'])).toEqual({ Postcode: 'zip' });
  });

  it('matches what an American spreadsheet actually says', () => {
    expect(guessMapping('customers', ['ZIP code'])).toEqual({ 'ZIP code': 'zip' });
    expect(guessMapping('customers', ['Zip'])).toEqual({ Zip: 'zip' });
  });

  it('matches the shipping one under both spellings', () => {
    // This is the pair the alias list was added for: `ship_zip` had no aliases
    // at all, so its LABEL was the only thing matching it, and the label moved.
    expect(guessMapping('orders', ['Ship to postcode'])).toEqual({
      'Ship to postcode': 'ship_zip',
    });
    expect(guessMapping('orders', ['Ship to postal code'])).toEqual({
      'Ship to postal code': 'ship_zip',
    });
  });
});

describe('a stock list with both "On hand" and "Available"', () => {
  // These are different numbers: available is on hand minus what is already
  // promised to somebody. `available` is also one of the aliases for `quantity`,
  // so in a single matching round whichever column came first in the file won.
  //
  // The import no longer offers an Available field at all: the platform works
  // it out from what is on hand and what is promised, so nothing wrote it. That
  // leaves "Available" mapped to nothing, which is right, and the danger this
  // guards is unchanged: it must never take `quantity` away from "On hand".
  const RIGHT = { 'On hand': 'quantity' };

  it('reads both columns correctly with On hand first', () => {
    expect(guessMapping('inventory_levels', ['On hand', 'Available'])).toEqual(RIGHT);
  });

  it('reads both columns the same way with Available first', () => {
    // The failing order. "Available" used to claim `quantity` by alias, and
    // "On hand" was then left mapped to nothing: her real stock count was
    // dropped and her available count was imported as the stock count.
    expect(guessMapping('inventory_levels', ['Available', 'On hand'])).toEqual(RIGHT);
  });

  it('still lets the alias work where the entity has no Available field', () => {
    // On products there is only one count, so "Available" meaning quantity is
    // the right guess and must survive.
    expect(guessMapping('products', ['SKU', 'Available'])).toEqual({
      SKU: 'sku',
      Available: 'quantity',
    });
  });
});

describe('every field is reachable by the name printed beside it', () => {
  it('maps each label back to its own field, for every entity', () => {
    // The general form of the bug above. A label nobody can match is a column
    // the owner has to set by hand on every import, and nothing else would say
    // so: the screen still draws the field, it simply never fills itself in.
    const unreachable: string[] = [];

    for (const [entity, fields] of Object.entries(ENTITY_FIELDS)) {
      for (const field of fields) {
        const mapping = guessMapping(entity as never, [field.label]);
        if (mapping[field.label] !== field.key) {
          unreachable.push(`${entity}.${field.key} labelled "${field.label}"`);
        }
      }
    }

    expect(unreachable).toEqual([]);
  });
});
