// Another signed-in buyer's cart is not yours (sparx persona issue 192).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { cartUsableBy } from './cart-owner';

describe('cartUsableBy', () => {
  it('refuses a cart that belongs to another signed-in buyer', () => {
    expect(cartUsableBy('renee', 'brynn')).toBe(false);
  });

  it('lets its owner in', () => {
    expect(cartUsableBy('renee', 'renee')).toBe(true);
  });

  it('lets a guest cart, or an anonymous token holder, through', () => {
    expect(cartUsableBy(null, 'brynn')).toBe(true);
    expect(cartUsableBy('renee', null)).toBe(true);
  });

  it('the cart routes ask it', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./public-commerce-context.ts', import.meta.url)),
      'utf8'
    );
    expect(source).toMatch(/cartUsableBy\(\s*cart\.customerId/);
  });
});
