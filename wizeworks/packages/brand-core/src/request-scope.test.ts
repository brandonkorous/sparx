// A process serving two brands must never answer one brand's question with the
// other's name. These prove the scope wins over the environment, survives an
// await, isolates concurrent requests, and that request mode fails closed.

import { afterEach, describe, expect, it } from 'vitest';
import { currentPlatformBrand } from './index';
import { runAsBrand, scopedPlatformBrand } from './request-scope';

const TOUCHED = ['PLATFORM_BRAND', 'PLATFORM_BRAND_SOURCE'] as const;
const saved = Object.fromEntries(TOUCHED.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of TOUCHED) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('runAsBrand', () => {
  it('answers from the scope, not the environment', () => {
    process.env.PLATFORM_BRAND = 'sparx';
    expect(runAsBrand('piggles', () => currentPlatformBrand())).toBe('piggles');
    expect(currentPlatformBrand()).toBe('sparx');
  });

  it('keeps the brand across an await', async () => {
    const seen = await runAsBrand('piggles', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return currentPlatformBrand();
    });
    expect(seen).toBe('piggles');
  });

  it('keeps two concurrent requests apart', async () => {
    const slow = (brand: string, ms: number) =>
      runAsBrand(brand, async () => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        return currentPlatformBrand();
      });
    const [a, b] = await Promise.all([slow('piggles', 20), slow('sparx', 5)]);
    expect([a, b]).toEqual(['piggles', 'sparx']);
  });

  it('normalizes the brand key', () => {
    expect(runAsBrand('  Piggles ', () => scopedPlatformBrand())).toBe('piggles');
  });

  it('refuses an empty brand', () => {
    expect(() => runAsBrand('  ', () => 1)).toThrow(/no brand given/);
  });

  it('is null outside a scope', () => {
    expect(scopedPlatformBrand()).toBeNull();
  });
});

describe('PLATFORM_BRAND_SOURCE=request', () => {
  it('throws outside a scope instead of answering the default brand', () => {
    process.env.PLATFORM_BRAND_SOURCE = 'request';
    process.env.PLATFORM_BRAND = 'sparx';
    expect(() => currentPlatformBrand()).toThrow(/Refusing to guess a brand/);
  });

  it('answers inside a scope', () => {
    process.env.PLATFORM_BRAND_SOURCE = 'request';
    expect(runAsBrand('piggles', () => currentPlatformBrand())).toBe('piggles');
  });

  it('without request mode, an unscoped call still reads the environment', () => {
    process.env.PLATFORM_BRAND = 'piggles';
    expect(currentPlatformBrand()).toBe('piggles');
  });
});
