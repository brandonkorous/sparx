// The spine authoring helpers (docs/98 Pillar 7) must emit bindings that VALIDATE
// against the canonical BindingSchema and CLASSIFY as the right kind — they are the
// only ergonomic way a catalog composite expresses a repeater / action, so a drift
// between the helper and the schema would ship a malformed tree to every tenant.

import { describe, it, expect } from 'vitest';
import { el, atom, bound, repeat, act } from './_kit';
import { BindingSchema, bindingKind } from '../node';

describe('catalog kit — spine binding helpers', () => {
  it('repeat() emits a valid collection source that classifies as "collection"', () => {
    const node = repeat(el('div', 'grid'), { from: 'all', limit: 6 });
    const parsed = BindingSchema.safeParse(node.binding);
    expect(parsed.success).toBe(true);
    expect(node.binding?.source).toEqual({ from: 'all', limit: 6 });
    expect(bindingKind(node.binding)).toBe('collection');
  });

  it('repeat() to a specific collection keeps its id (schema requires it)', () => {
    const node = repeat(el('div', ''), { from: 'collection', id: 'col_123' });
    expect(BindingSchema.safeParse(node.binding).success).toBe(true);
    // The schema rejects a collection/category source with no id.
    expect(BindingSchema.safeParse({ source: { from: 'collection' } }).success).toBe(false);
  });

  it('act() emits a valid action binding; href only when given', () => {
    const cart = act(atom('Button', 'st-btn', { label: 'Add to cart' }), 'add-to-cart');
    expect(BindingSchema.safeParse(cart.binding).success).toBe(true);
    expect(cart.binding).toEqual({ action: 'add-to-cart' });
    expect(bindingKind(cart.binding)).toBe('action');

    const link = act(el('a', ''), 'link', '/products');
    expect(link.binding).toEqual({ action: 'link', href: '/products' });
    expect(BindingSchema.safeParse(link.binding).success).toBe(true);
  });

  it('bound() still writes a plain field path (unchanged)', () => {
    const node = bound(atom('Heading', '', { level: 'h3', text: 'X' }), 'item.title');
    expect(node.binding).toEqual({ path: 'item.title' });
    expect(bindingKind(node.binding)).toBe('field');
  });
});
