// Sparx persona issue 194: the Orders page asked for 10 orders and had no way to
// the 11th. Six other account lists paged, each with its own copy of the pager,
// and the copies said it three ways ("1 to 20 of 45", "1–20 of 45", "Page 1 of
// 3"). One pager now, and every account list uses it.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { pagerWords } from './pager-words';

describe('pagerWords', () => {
  it('says which ones are shown, of how many', () => {
    expect(pagerWords(0, 20, 45)).toBe('1 to 20 of 45');
    expect(pagerWords(40, 20, 45)).toBe('41 to 45 of 45');
  });

  it('is null when everything fits on one page', () => {
    expect(pagerWords(0, 20, 20)).toBeNull();
    expect(pagerWords(0, 20, 0)).toBeNull();
  });
});

describe('every account list pages the same way', () => {
  const root = fileURLToPath(new URL('../app/account', import.meta.url));
  const pages: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name === 'page.tsx') pages.push(path);
    }
  };
  walk(root);

  it('finds the account pages', () => {
    expect(pages.length).toBeGreaterThan(10);
  });

  it('no page draws its own Previous and Next', () => {
    const own = pages.filter((p) => /^\s*Previous\s*$/m.test(readFileSync(p, 'utf8')));
    expect(own).toEqual([]);
  });

  it('the Orders page pages', () => {
    const orders = pages.find((p) => p.endsWith(join('(authed)', 'orders', 'page.tsx')));
    expect(orders).toBeDefined();
    expect(readFileSync(orders!, 'utf8')).toContain('<ListPager');
  });
});
