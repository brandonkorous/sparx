import { describe, expect, it } from 'vitest';

import { applyCalculatedFields, checkExpression, evaluateExpression } from './calc';
import type { FieldSchema } from './types';

describe('evaluateExpression', () => {
  it('does arithmetic with the usual precedence', () => {
    expect(evaluateExpression('2 + 3 * 4', {})).toBe(14);
    expect(evaluateExpression('(2 + 3) * 4', {})).toBe(20);
    expect(evaluateExpression('-3 + 10', {})).toBe(7);
  });

  it('reads sibling field values', () => {
    expect(evaluateExpression('price - cost', { price: 100, cost: 40 })).toBe(60);
  });

  it('takes the amount out of a currency sibling', () => {
    expect(evaluateExpression('price * 2', { price: { amount: 12.5, currency: 'USD' } })).toBe(25);
  });

  it('treats a missing or unusable value as zero rather than failing', () => {
    expect(evaluateExpression('price - cost', { price: 100 })).toBe(100);
    expect(evaluateExpression('price - cost', { price: 100, cost: null })).toBe(100);
    expect(evaluateExpression('price - cost', { price: 100, cost: 'not a number' })).toBe(100);
  });

  it('parses numeric strings, because an imported CSV is full of them', () => {
    expect(evaluateExpression('price - cost', { price: '100', cost: '40' })).toBe(60);
  });

  it('supports the four functions', () => {
    expect(evaluateExpression('round(10 / 3, 2)', {})).toBe(3.33);
    expect(evaluateExpression('abs(0 - 5)', {})).toBe(5);
    expect(evaluateExpression('min(3, 9, 1)', {})).toBe(1);
    expect(evaluateExpression('max(3, 9, 1)', {})).toBe(9);
  });

  it('returns null for division by nothing instead of Infinity', () => {
    expect(evaluateExpression('10 / qty', { qty: 0 })).toBeNull();
    expect(evaluateExpression('10 / qty', {})).toBeNull();
  });

  it('returns null rather than throwing on a broken expression', () => {
    expect(evaluateExpression('2 +', {})).toBeNull();
    expect(evaluateExpression('(2 + 3', {})).toBeNull();
    expect(evaluateExpression('2 ** 3', {})).toBeNull();
  });

  // The whole reason this is a hand-written parser.
  it('cannot reach the host environment', () => {
    expect(evaluateExpression('process.exit(1)', {})).toBeNull();
    expect(evaluateExpression('globalThis', {})).toBe(0); // an unknown FIELD, resolving to 0
    expect(evaluateExpression('constructor("return 1")()', {})).toBeNull();
    expect(evaluateExpression('[].constructor', {})).toBeNull();
  });

  it('refuses a pathologically nested expression', () => {
    expect(evaluateExpression(`${'('.repeat(200)}1${')'.repeat(200)}`, {})).toBeNull();
  });
});

describe('checkExpression', () => {
  it('passes a good expression', () => {
    expect(checkExpression('price - cost', ['price', 'cost'])).toBeNull();
    expect(checkExpression('round(price * 0.2, 2)', ['price'])).toBeNull();
  });

  it('names a field that does not exist, since it would silently be zero', () => {
    expect(checkExpression('price - kost', ['price', 'cost'])).toMatch(/kost/);
  });

  it('names an unknown function', () => {
    expect(checkExpression('sqrt(price)', ['price'])).toMatch(/sqrt/);
  });

  it('reports an unclosed bracket', () => {
    expect(checkExpression('(price - cost', ['price', 'cost'])).toMatch(/bracket/i);
  });

  it('reports a character that cannot appear at all', () => {
    expect(checkExpression('price % cost', ['price', 'cost'])).toMatch(/%/);
  });
});

describe('applyCalculatedFields', () => {
  const schema: FieldSchema = {
    fields: [
      { key: 'price', label: 'Price', type: 'number' },
      { key: 'cost', label: 'Cost', type: 'number' },
      {
        key: 'margin',
        label: 'Margin',
        type: 'calculated',
        expression: 'price - cost',
        precision: 2,
      },
    ],
  };

  it('overwrites the calculated key with the server-computed value', () => {
    const out = applyCalculatedFields(schema, { price: 100, cost: 40.005, margin: 999_999 });
    expect(out.margin).toBe(60);
    expect(out.price).toBe(100);
  });

  it('stores null when the expression cannot produce a number', () => {
    const divide: FieldSchema = {
      fields: [
        { key: 'total', label: 'Total', type: 'number' },
        { key: 'qty', label: 'Quantity', type: 'number' },
        { key: 'each', label: 'Each', type: 'calculated', expression: 'total / qty' },
      ],
    };
    expect(applyCalculatedFields(divide, { total: 10, qty: 0 }).each).toBeNull();
  });

  it('emits a currency value when the field asks for one', () => {
    const money: FieldSchema = {
      fields: [
        { key: 'price', label: 'Price', type: 'number' },
        {
          key: 'tax',
          label: 'Tax',
          type: 'calculated',
          expression: 'price * 0.2',
          resultType: 'currency',
          currency: 'GBP',
          precision: 2,
        },
      ],
    };
    expect(applyCalculatedFields(money, { price: 50 }).tax).toEqual({
      amount: 10,
      currency: 'GBP',
    });
  });

  it('does not let one calculated field read another', () => {
    const chained: FieldSchema = {
      fields: [
        { key: 'a', label: 'A', type: 'number' },
        { key: 'b', label: 'B', type: 'calculated', expression: 'a * 2' },
        { key: 'c', label: 'C', type: 'calculated', expression: 'b * 2' },
      ],
    };
    const out = applyCalculatedFields(chained, { a: 5, b: 10, c: 20 });
    expect(out.b).toBe(10);
    // `b` is invisible to `c` — it resolves to 0, so `c` is 0, not 20.
    expect(out.c).toBe(0);
  });

  it('leaves a schema with no calculated fields untouched', () => {
    const plain: FieldSchema = { fields: [{ key: 'a', label: 'A', type: 'number' }] };
    const input = { a: 1 };
    expect(applyCalculatedFields(plain, input)).toBe(input);
  });
});
