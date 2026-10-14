// A cart ends with the session of the buyer it belonged to (sparx persona issue 192).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { cartEndsWithSession } from './cart-session';

describe('cartEndsWithSession', () => {
  it('drops the cart when its buyer signs out', () => {
    expect(cartEndsWithSession('renee', null)).toBe(true);
  });

  it('drops it when somebody else signs in', () => {
    expect(cartEndsWithSession('renee', 'brynn')).toBe(true);
  });

  it('keeps a guest cart when the guest signs in', () => {
    expect(cartEndsWithSession(null, 'brynn')).toBe(false);
  });

  it('keeps it while the same buyer stays', () => {
    expect(cartEndsWithSession('renee', 'renee')).toBe(false);
  });

  it('the cart asks it', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../components/cart-provider.tsx', import.meta.url)),
      'utf8'
    );
    expect(source).toContain('cartEndsWithSession(');
  });
});
