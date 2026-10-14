// A page's address hint names the owner's site and a path the site serves.
//
// The category hint read "yoursite.com/c/injectors": a made-up address, and a
// path the site has never had, so the link Doty copied was a Not Found page
// (sparx persona issue 225; Piggles had fixed the path as its issue 383).

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { pageAddress, type AddressedRecord } from './page-address';

const here = dirname(fileURLToPath(import.meta.url));
const siteApp = join(here, '../../../../../wizeworks/apps/site/app');

describe('pageAddress', () => {
  it('puts the category under /category/, where the site serves it', () => {
    expect(pageAddress('gillettdiesel.sparx.zone', 'commerce.category', 'injectors')).toBe(
      'gillettdiesel.sparx.zone/category/injectors'
    );
  });

  it('gives the path alone when no address is known, never a made-up one', () => {
    expect(pageAddress(null, 'commerce.product', 'bosch-0986435621')).toBe(
      '/products/bosch-0986435621'
    );
  });

  it.each<[AddressedRecord, string]>([
    ['commerce.product', 'products'],
    ['commerce.collection', 'collections'],
    ['commerce.category', 'category'],
  ])('%s: the site has a page at that path', (record, folder) => {
    const path = pageAddress(null, record, 'x');
    expect(path).toBe(`/${folder}/x`);
    expect(existsSync(join(siteApp, folder, '[handle]', 'page.tsx'))).toBe(true);
  });
});

describe('the three hints use it', () => {
  it.each(['category-detail-basics.tsx', 'collection-detail-basics.tsx', 'product-add-fields.tsx'])(
    '%s prints a real address',
    (file) => {
      const source = readFileSync(join(here, file), 'utf8');
      expect(source).not.toContain('yoursite.com');
      expect(source).toMatch(/pageAddress\(\s*host/);
    }
  );
});
