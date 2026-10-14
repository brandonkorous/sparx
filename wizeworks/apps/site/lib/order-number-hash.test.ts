// An order number is printed as it is (sparx persona issue 195).
//
// Order numbers here carry their own letters ("O-000022", "SO-000003"). The site
// called one order "#O-000022" on the Orders page and the order page, and
// "O-000022" at checkout, on the wholesale pages and in the approval notices; the
// staff notices said "Order #O-000022" too. A "#" in front of a number that
// already has a prefix adds nothing and makes one order read as two. This reads
// the code that prints order numbers and fails on a "#" in front of one.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = fileURLToPath(new URL('.', import.meta.url));
const ROOTS = [
  join(here, '..', 'app'),
  join(here, '..', 'components'),
  join(here, '..', 'lib'),
  join(here, '..', '..', '..', 'packages', 'commerce', 'src'),
  join(here, '..', '..', '..', 'packages', 'email', 'src'),
  // The wholesale approval notes on the customer's timeline said "Order #O-000023
  // approved by …" (found on the second pass, 2026-10-11).
  join(here, '..', '..', '..', 'packages', 'b2b', 'src'),
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('an order number is printed as it is', () => {
  const files = ROOTS.flatMap(sourceFiles);

  it('reads the code it guards', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it('never puts a "#" in front of one', () => {
    const found: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (/#\$?\{[^}]*orderNumber/i.test(line)) found.push(`${file}:${String(index + 1)}`);
        });
    }
    expect(found).toEqual([]);
  });

  it('a return links to the order it came from', () => {
    const page = readFileSync(
      join(here, '..', 'app', 'account', '(authed)', 'returns', '[returnId]', 'page.tsx'),
      'utf8'
    );
    expect(page).toContain('href={`/account/orders/${detail.orderId}`}');
  });
});
