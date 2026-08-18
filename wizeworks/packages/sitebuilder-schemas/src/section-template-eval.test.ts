import { describe, it, expect } from 'vitest';
import {
  lookupPath,
  formatValue,
  resolveValue,
  evalCondition,
  resolveEnum,
  type EvalContext,
  type EvalScope,
} from './section-template-eval';

const CTX: EvalContext = { currency: 'USD', locale: 'en-US', tenantSlug: 'acme' };

const SCOPE: EvalScope = {
  field: { heading: 'Hello', columns: '3', empty: '' },
  item: { title: 'Item A', price: 1299 },
  index: 2,
  product: { title: 'Widget', price: 49.5 },
};

describe('lookupPath', () => {
  it('resolves field / item / index / ctx', () => {
    expect(lookupPath('field.heading', SCOPE, CTX)).toBe('Hello');
    expect(lookupPath('item.title', SCOPE, CTX)).toBe('Item A');
    expect(lookupPath('index', SCOPE, CTX)).toBe(2);
    expect(lookupPath('ctx.currency', SCOPE, CTX)).toBe('USD');
    expect(lookupPath('ctx.tenantSlug', SCOPE, CTX)).toBe('acme');
  });

  it('resolves bound product paths and returns undefined for absent scopes', () => {
    expect(lookupPath('product.title', SCOPE, CTX)).toBe('Widget');
    expect(lookupPath('collection.name', SCOPE, CTX)).toBeUndefined();
    expect(lookupPath('item.title', { field: {} }, CTX)).toBeUndefined();
  });

  it('returns undefined for unknown roots / paths', () => {
    expect(lookupPath('window.location', SCOPE, CTX)).toBeUndefined();
    expect(lookupPath('field.nope', SCOPE, CTX)).toBeUndefined();
    expect(lookupPath('ctx.secret', SCOPE, CTX)).toBeUndefined();
  });

  it('walks nested object + array paths', () => {
    const scope: EvalScope = { field: { images: [{ url: 'a.jpg' }, { url: 'b.jpg' }] } };
    expect(lookupPath('field.images.1.url', scope, CTX)).toBe('b.jpg');
    expect(lookupPath('field.images.9.url', scope, CTX)).toBeUndefined();
  });
});

describe('formatValue', () => {
  it('formats money in the context currency', () => {
    expect(formatValue(1299.5, 'money', CTX)).toBe('$1,299.50');
  });
  it('formats numbers with grouping', () => {
    expect(formatValue(1234567, 'number', CTX)).toBe('1,234,567');
  });
  it('falls back to String for non-numeric money', () => {
    expect(formatValue('N/A', 'money', CTX)).toBe('N/A');
  });
  it('passes through with no/none format', () => {
    expect(formatValue('plain', undefined, CTX)).toBe('plain');
    expect(formatValue(42, 'none', CTX)).toBe('42');
  });
});

describe('resolveValue', () => {
  it('returns a literal unchanged', () => {
    expect(resolveValue('Shop now', SCOPE, CTX)).toBe('Shop now');
  });
  it('resolves a $bind', () => {
    expect(resolveValue({ $bind: 'field.heading' }, SCOPE, CTX)).toBe('Hello');
  });
  it('uses the default when the bound value is empty/absent', () => {
    expect(resolveValue({ $bind: 'field.empty', default: 'Fallback' }, SCOPE, CTX)).toBe(
      'Fallback'
    );
    expect(resolveValue({ $bind: 'field.missing', default: 'D' }, SCOPE, CTX)).toBe('D');
    expect(resolveValue({ $bind: 'field.missing' }, SCOPE, CTX)).toBe('');
  });
  it('applies a formatter on a bound value', () => {
    expect(resolveValue({ $bind: 'product.price', format: 'money' }, SCOPE, CTX)).toBe('$49.50');
  });
  it('concatenates parts', () => {
    expect(
      resolveValue(
        { $concat: ['From ', { $bind: 'product.price', format: 'money' }, '/mo'] },
        SCOPE,
        CTX
      )
    ).toBe('From $49.50/mo');
  });
});

describe('evalCondition', () => {
  it('$exists is true for a non-empty value, false otherwise', () => {
    expect(evalCondition({ $exists: 'field.heading' }, SCOPE, CTX)).toBe(true);
    expect(evalCondition({ $exists: 'field.empty' }, SCOPE, CTX)).toBe(false);
    expect(evalCondition({ $exists: 'field.missing' }, SCOPE, CTX)).toBe(false);
  });
  it('$exists is false for an empty array, true for a populated one', () => {
    expect(evalCondition({ $exists: 'field.items' }, { field: { items: [] } }, CTX)).toBe(false);
    expect(evalCondition({ $exists: 'field.items' }, { field: { items: [1] } }, CTX)).toBe(true);
  });
  it('$eq compares by string coercion', () => {
    expect(evalCondition({ $eq: ['field.columns', '3'] }, SCOPE, CTX)).toBe(true);
    expect(evalCondition({ $eq: ['field.columns', 3] }, SCOPE, CTX)).toBe(true);
    expect(evalCondition({ $eq: ['field.columns', '4'] }, SCOPE, CTX)).toBe(false);
  });
});

describe('resolveEnum', () => {
  const allowed = ['1', '2', '3', '4'] as const;
  it('passes a valid literal through', () => {
    expect(resolveEnum('3', allowed, '2', SCOPE, CTX)).toBe('3');
  });
  it('falls back for an invalid literal or undefined', () => {
    expect(resolveEnum('9', allowed, '2', SCOPE, CTX)).toBe('2');
    expect(resolveEnum(undefined, allowed, '2', SCOPE, CTX)).toBe('2');
  });
  it('resolves a binding to a valid token, else falls back', () => {
    expect(resolveEnum({ $bind: 'field.columns' }, allowed, '2', SCOPE, CTX)).toBe('3');
    expect(resolveEnum({ $bind: 'field.heading' }, allowed, '2', SCOPE, CTX)).toBe('2');
  });
});
