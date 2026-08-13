// Custom-field coercion (docs/146 §6 Phase 11.8).
//
// One claim, tested from every angle a value can arrive from:
//
//   A FIELD'S TYPE IS A PROMISE, AND COERCION IS THE ONE PLACE IT IS KEPT.
//
// Which means refusing, not guessing. A number field handed "n/a" must produce
// an error somebody sees — not a silent zero, which puts a measurement where an
// absence belongs, and not a stored string, which breaks every report that later
// tries to add the column up.

import { describe, expect, it } from 'vitest';

import {
  CreateCustomFieldInput,
  UpdateCustomFieldInput,
  coerceCustomFieldValue,
  customFieldColumn,
  customFieldCsvValue,
  formatCustomFieldValue,
  normalizeFieldKey,
  readCustomFields,
  validateCustomFieldValues,
  type CustomFieldDefinition,
} from './custom-fields';

const field = (over: Partial<CustomFieldDefinition> = {}): CustomFieldDefinition => ({
  id: 'f1',
  entity: 'level',
  key: 'aisle',
  label: 'Aisle',
  type: 'text',
  options: [],
  helpText: null,
  required: false,
  showInList: false,
  position: 0,
  isActive: true,
  ...over,
});

describe('normalizeFieldKey', () => {
  it('makes a storable key out of a human label', () => {
    expect(normalizeFieldKey('Aisle')).toBe('aisle');
    expect(normalizeFieldKey('Certified until')).toBe('certified_until');
    expect(normalizeFieldKey('  Customer / job  ')).toBe('customer_job');
  });

  it('is empty when there is nothing to key on, so the caller can refuse', () => {
    expect(normalizeFieldKey('###')).toBe('');
  });
});

describe('customFieldColumn', () => {
  it('prefixes so a field called "note" cannot collide with the importer', () => {
    expect(customFieldColumn('note')).toBe('cf_note');
  });
});

describe('coerceCustomFieldValue', () => {
  it('reads blank as null, never as the type zero', () => {
    expect(coerceCustomFieldValue(field({ type: 'number' }), '')).toEqual({
      ok: true,
      value: null,
    });
    expect(coerceCustomFieldValue(field({ type: 'boolean' }), null)).toEqual({
      ok: true,
      value: null,
    });
    expect(coerceCustomFieldValue(field({ type: 'multi_select', options: ['a'] }), [])).toEqual({
      ok: true,
      value: null,
    });
  });

  it('refuses blank on a required field', () => {
    const result = coerceCustomFieldValue(field({ required: true }), '');
    expect(result.ok).toBe(false);
  });

  it('refuses text in a number field rather than storing it', () => {
    const result = coerceCustomFieldValue(field({ type: 'number' }), 'n/a');
    expect(result).toEqual({ ok: false, error: 'Aisle must be a number' });
  });

  it('accepts a number with grouping and a currency symbol', () => {
    expect(coerceCustomFieldValue(field({ type: 'number' }), '1,234')).toEqual({
      ok: true,
      value: 1234,
    });
    expect(coerceCustomFieldValue(field({ type: 'money' }), '$12.50')).toEqual({
      ok: true,
      value: 1250,
    });
  });

  it('stores money in cents, like everywhere else in the platform', () => {
    expect(coerceCustomFieldValue(field({ type: 'money' }), 12.5)).toEqual({
      ok: true,
      value: 1250,
    });
  });

  it('reduces a date to a day, with no timezone-shifted midnight', () => {
    expect(coerceCustomFieldValue(field({ type: 'date' }), '2026-08-12T14:00:00Z')).toEqual({
      ok: true,
      value: '2026-08-12',
    });
    expect(coerceCustomFieldValue(field({ type: 'date' }), 'not a date').ok).toBe(false);
  });

  it('reads the several ways people write yes', () => {
    for (const yes of [true, 'true', 'Yes', 'y', '1']) {
      expect(coerceCustomFieldValue(field({ type: 'boolean' }), yes)).toEqual({
        ok: true,
        value: true,
      });
    }
    for (const no of [false, 'false', 'No', 'n', '0']) {
      expect(coerceCustomFieldValue(field({ type: 'boolean' }), no)).toEqual({
        ok: true,
        value: false,
      });
    }
    expect(coerceCustomFieldValue(field({ type: 'boolean' }), 'maybe').ok).toBe(false);
  });

  it('stores a choice as DEFINED, not as typed, so a list groups', () => {
    const definition = field({ type: 'select', options: ['Aisle A', 'Aisle B'] });
    expect(coerceCustomFieldValue(definition, 'aisle a')).toEqual({
      ok: true,
      value: 'Aisle A',
    });
    expect(coerceCustomFieldValue(definition, 'Aisle C').ok).toBe(false);
  });

  it('splits a multi-select on any of the separators a spreadsheet uses', () => {
    const definition = field({ type: 'multi_select', options: ['Fragile', 'Heavy', 'Hazard'] });
    expect(coerceCustomFieldValue(definition, 'Fragile|Heavy')).toEqual({
      ok: true,
      value: ['Fragile', 'Heavy'],
    });
    expect(coerceCustomFieldValue(definition, 'Heavy; Hazard')).toEqual({
      ok: true,
      value: ['Heavy', 'Hazard'],
    });
    expect(coerceCustomFieldValue(definition, 'Heavy, Nope').ok).toBe(false);
  });

  it('does not duplicate a choice given twice', () => {
    const definition = field({ type: 'multi_select', options: ['Fragile'] });
    expect(coerceCustomFieldValue(definition, 'Fragile|fragile')).toEqual({
      ok: true,
      value: ['Fragile'],
    });
  });

  it('accepts a link as typed rather than rewriting it', () => {
    expect(coerceCustomFieldValue(field({ type: 'url' }), 'example.com/spec')).toEqual({
      ok: true,
      value: 'example.com/spec',
    });
    expect(coerceCustomFieldValue(field({ type: 'url' }), 'has a space').ok).toBe(false);
  });
});

describe('validateCustomFieldValues', () => {
  const definitions = [
    field({ key: 'aisle', label: 'Aisle' }),
    field({ id: 'f2', key: 'count', label: 'Count', type: 'number' }),
    field({ id: 'f3', key: 'gone', label: 'Removed', isActive: false }),
  ];

  it('is a PATCH — untouched keys keep their stored value', () => {
    const result = validateCustomFieldValues(definitions, { aisle: 'B' }, { count: 4 });
    expect(result.values).toEqual({ count: 4, aisle: 'B' });
    expect(result.errors).toEqual([]);
  });

  it('ignores a key no live definition claims', () => {
    const result = validateCustomFieldValues(definitions, { gone: 'x', nonsense: 1 }, {});
    expect(result.values).toEqual({});
    expect(result.errors).toEqual([]);
  });

  it('collects every bad value rather than stopping at the first', () => {
    const definitions2 = [
      field({ key: 'a', label: 'A', type: 'number' }),
      field({ id: 'f2', key: 'b', label: 'B', type: 'number' }),
    ];
    const result = validateCustomFieldValues(definitions2, { a: 'x', b: 'y' }, {});
    expect(result.errors).toHaveLength(2);
  });
});

describe('readCustomFields', () => {
  it('drops values whose definition is gone, and keeps them null-safe', () => {
    const definitions = [field({ key: 'aisle' })];
    expect(readCustomFields(definitions, { aisle: 'A', removed: 'x' })).toEqual({ aisle: 'A' });
    expect(readCustomFields(definitions, null)).toEqual({ aisle: null });
    expect(readCustomFields(definitions, 'not an object')).toEqual({ aisle: null });
  });
});

describe('formatting', () => {
  it('returns null for null so the caller renders a dash, not a zero', () => {
    expect(formatCustomFieldValue(field({ type: 'money' }), null)).toBeNull();
    expect(formatCustomFieldValue(field({ type: 'boolean' }), null)).toBeNull();
  });

  it('says yes and no rather than true and false', () => {
    expect(formatCustomFieldValue(field({ type: 'boolean' }), true)).toBe('Yes');
    expect(formatCustomFieldValue(field({ type: 'boolean' }), false)).toBe('No');
  });

  it('pipe-joins a list for CSV so a comma in a choice cannot split a column', () => {
    expect(customFieldCsvValue(['Fragile', 'Heavy'])).toBe('Fragile|Heavy');
    expect(customFieldCsvValue(null)).toBeNull();
  });
});

describe('input schemas', () => {
  it('the update schema carries no defaults — the .partial() trap', () => {
    // `CreateCustomFieldInput.partial()` would keep every `.default()`, so
    // renaming a field would silently reset required, showInList and position.
    const patch = UpdateCustomFieldInput.parse({ label: 'Renamed' });
    expect(patch).toEqual({ label: 'Renamed' });
    expect('required' in patch).toBe(false);
    expect('showInList' in patch).toBe(false);
  });

  it('the create schema fills in the sensible defaults', () => {
    const created = CreateCustomFieldInput.parse({
      entity: 'level',
      label: 'Aisle',
      type: 'text',
    });
    expect(created.required).toBe(false);
    expect(created.showInList).toBe(false);
    expect(created.options).toEqual([]);
  });

  it('refuses a key a spreadsheet or a URL would mangle', () => {
    expect(
      CreateCustomFieldInput.safeParse({
        entity: 'level',
        label: 'Aisle',
        type: 'text',
        key: 'Not A Key',
      }).success
    ).toBe(false);
  });
});
