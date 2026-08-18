import { describe, expect, it } from 'vitest';

import { coerceFromText, parseLooseDate, parseLooseNumber } from './coerce';
import type { FieldDef } from './types';

const text: FieldDef = { key: 'note', label: 'Note', type: 'text' };
const num: FieldDef = { key: 'seats', label: 'Seats', type: 'number' };
const whole: FieldDef = { key: 'seats', label: 'Seats', type: 'number', integer: true };
const money: FieldDef = { key: 'fee', label: 'Fee', type: 'currency', currency: 'USD' };
const yesNo: FieldDef = { key: 'onPlan', label: 'On plan', type: 'boolean' };
const day: FieldDef = { key: 'expires', label: 'Expires', type: 'date' };
const pick: FieldDef = {
  key: 'terms',
  label: 'Terms',
  type: 'enum',
  options: [
    { value: 'net30', label: 'Net 30' },
    { value: 'prepay', label: 'Pay up front' },
  ],
};
const worked: FieldDef = {
  key: 'margin',
  label: 'Margin',
  type: 'calculated',
  expression: 'price - cost',
};

describe('parseLooseNumber', () => {
  it('reads numbers the way a spreadsheet writes them', () => {
    expect(parseLooseNumber('1,250.00')).toBe(1250);
    expect(parseLooseNumber('$4,800')).toBe(4800);
    expect(parseLooseNumber('12.5%')).toBe(12.5);
    expect(parseLooseNumber('(300)')).toBe(-300);
    expect(parseLooseNumber('-7')).toBe(-7);
  });

  // The whole reason this returns null instead of NaN or 0: a blank cell must
  // not become a real zero somebody has to explain later.
  it('returns null rather than zero for a blank or unreadable cell', () => {
    expect(parseLooseNumber('')).toBeNull();
    expect(parseLooseNumber('   ')).toBeNull();
    expect(parseLooseNumber('n/a')).toBeNull();
    expect(parseLooseNumber('12 units')).toBeNull();
  });
});

describe('parseLooseDate', () => {
  it('reads ISO and the US form a spreadsheet exports', () => {
    expect(parseLooseDate('2027-03-14')).toBe('2027-03-14');
    expect(parseLooseDate('3/14/2027')).toBe('2027-03-14');
    expect(parseLooseDate('03/04/2027')).toBe('2027-03-04');
  });

  it('refuses what it cannot read rather than guessing', () => {
    expect(parseLooseDate('14/03/2027')).toBeNull(); // month 14 — not a US date
    expect(parseLooseDate('next Tuesday')).toBeNull();
  });
});

describe('coerceFromText', () => {
  it('leaves a blank cell alone instead of writing an empty value', () => {
    expect(coerceFromText(text, '')).toEqual({});
    expect(coerceFromText(num, '   ')).toEqual({});
    expect(coerceFromText(day, '')).toEqual({});
  });

  // The one deliberate exception: an unticked box exports as an empty cell.
  it('reads a blank yes/no cell as a no', () => {
    expect(coerceFromText(yesNo, '')).toEqual({ value: false });
  });

  it('reads the words a person actually types for yes and no', () => {
    for (const yes of ['yes', 'Y', 'TRUE', '1', 'x', '✓']) {
      expect(coerceFromText(yesNo, yes).value).toBe(true);
    }
    for (const no of ['no', 'N', 'false', '0', '-']) {
      expect(coerceFromText(yesNo, no).value).toBe(false);
    }
  });

  it('reports a yes/no it cannot read instead of defaulting to no', () => {
    const result = coerceFromText(yesNo, 'maybe');
    expect(result.value).toBeUndefined();
    expect(result.problem?.message).toContain('not a yes or a no');
  });

  it('enforces whole numbers when the field asks for them', () => {
    expect(coerceFromText(whole, '12').value).toBe(12);
    expect(coerceFromText(whole, '12.5').problem?.message).toContain('whole number');
  });

  it('keeps money with its currency, preferring the one written in the cell', () => {
    expect(coerceFromText(money, '4,800').value).toEqual({ amount: 4800, currency: 'USD' });
    expect(coerceFromText(money, '4800 EUR').value).toEqual({ amount: 4800, currency: 'EUR' });
  });

  it('matches a choice by its label as well as its stored value', () => {
    expect(coerceFromText(pick, 'net30').value).toBe('net30');
    expect(coerceFromText(pick, 'Net 30').value).toBe('net30');
    expect(coerceFromText(pick, 'Pay up front').value).toBe('prepay');
    expect(coerceFromText(pick, 'whenever').problem?.message).toContain('not one of the choices');
  });

  it('reads a multi-choice cell split on commas, pipes or semicolons', () => {
    const multi: FieldDef = { ...pick, multiple: true };
    expect(coerceFromText(multi, 'Net 30 | prepay').value).toEqual(['net30', 'prepay']);
  });

  // A calculated field is the server's arithmetic; a column for one is ignored
  // rather than reported, because the person exported what they were shown.
  it('ignores a column for a worked-out detail without complaining', () => {
    expect(coerceFromText(worked, '42')).toEqual({});
  });

  it('refuses a name where a record id is needed', () => {
    const owner: FieldDef = { key: 'owner', label: 'Owner', type: 'user' };
    expect(coerceFromText(owner, 'Dana Wells').problem?.message).toContain('is not an id');
    const id = '3f1b8c22-9c1e-4a3d-9f5a-1a2b3c4d5e6f';
    expect(coerceFromText(owner, id).value).toBe(id);
  });
});
