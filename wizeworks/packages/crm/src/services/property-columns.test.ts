import { describe, expect, it } from 'vitest';
import type { FieldSchema } from '@wizeworks/field-schema';

import { describeColumnProblems, propertiesFromRow } from './property-columns';

const schema: FieldSchema = {
  fields: [
    { key: 'warrantyExpires', label: 'Warranty expires', type: 'date' },
    { key: 'seats', label: 'Seats', type: 'number', integer: true },
    { key: 'company', label: 'Company', type: 'text' },
    { key: 'margin', label: 'Margin', type: 'calculated', expression: 'a - b' },
  ],
};

const RESERVED = ['email', 'first_name', 'company'] as const;

describe('propertiesFromRow', () => {
  it('does nothing when the business has declared no properties', () => {
    const result = propertiesFromRow({ fields: [] }, { anything: 'here' });
    expect(result.values).toEqual({});
    expect(result.matchedColumns).toEqual([]);
  });

  it('matches a column however the person spelled the heading', () => {
    for (const header of [
      'Warranty expires',
      'warranty expires',
      'WARRANTY_EXPIRES',
      'warrantyExpires',
      'custom.warrantyExpires',
    ]) {
      const result = propertiesFromRow(schema, { [header]: '2027-03-14' }, RESERVED);
      expect(result.values).toEqual({ warrantyExpires: '2027-03-14' });
    }
  });

  it('leaves a blank cell out of the bag entirely', () => {
    // Not `{ warrantyExpires: null }` — an import that touches three columns must
    // not blank the twelve it says nothing about.
    const result = propertiesFromRow(schema, { 'Warranty expires': '  ' }, RESERVED);
    expect(result.values).toEqual({});
    expect(result.problems).toEqual([]);
  });

  it('yields the built-in meaning of a column the importer already owns', () => {
    const result = propertiesFromRow(schema, { company: 'Wells Design Co' }, RESERVED);
    expect(result.values).toEqual({});
    expect(result.matchedColumns).toEqual([]);
  });

  it('lets an explicit custom. heading reach a property the built-in shadowed', () => {
    const result = propertiesFromRow(schema, { 'custom.company': 'Their parent group' }, RESERVED);
    expect(result.values).toEqual({ company: 'Their parent group' });
  });

  it('reports an unreadable cell rather than dropping the column', () => {
    const result = propertiesFromRow(schema, { Seats: 'about twelve' }, RESERVED);
    expect(result.values).toEqual({});
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]?.column).toBe('Seats');
    expect(describeColumnProblems(result.problems)).toContain('Seats:');
  });

  it('ignores a column for a worked-out detail', () => {
    const result = propertiesFromRow(schema, { Margin: '42' }, RESERVED);
    expect(result.values).toEqual({});
    expect(result.problems).toEqual([]);
  });

  it('ignores columns that name nothing the business declared', () => {
    const result = propertiesFromRow(schema, { 'Favourite color': 'blue' }, RESERVED);
    expect(result.values).toEqual({});
    expect(result.matchedColumns).toEqual([]);
  });

  it('reads several properties out of one row', () => {
    const result = propertiesFromRow(
      schema,
      { email: 'a@b.com', 'Warranty expires': '3/14/2027', Seats: '12' },
      RESERVED
    );
    expect(result.values).toEqual({ warrantyExpires: '2027-03-14', seats: 12 });
    expect(result.matchedColumns).toHaveLength(2);
  });
});
