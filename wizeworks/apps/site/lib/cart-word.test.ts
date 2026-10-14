// One word for the cart (sparx persona issue 186).
//
// The site's header, account page and address all say "cart". Thirteen sentences a
// shopper could read said "basket" instead, so Renée was told about "your basket"
// under a header that said "Cart". This reads every sentence the site and the
// shopper-facing API code can show, and fails on the other word. Comments and code
// identifiers (`not_basket_owner`) are not sentences and are left alone.

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
  join(here, '..', '..', '..', 'services', 'api-rest', 'src', 'lib'),
  join(here, '..', '..', '..', 'services', 'api-rest', 'src', 'routes', 'v1', 'public'),
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** A line that is a comment, not something a shopper reads. */
function isComment(line: string): boolean {
  return /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line);
}

describe('the cart is called the cart', () => {
  const files = ROOTS.flatMap(sourceFiles);

  it('reads the code it guards', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it('never says basket to a shopper', () => {
    const found: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (isComment(line)) return;
          // Followed by `.`, `(` or `[` it is a variable (`basket.has(id)`), not a word.
          if (/['"`>][^'"`<]*\bbasket\b(?![.([])/i.test(line)) {
            found.push(`${file}:${String(index + 1)}`);
          }
        });
    }
    expect(found).toEqual([]);
  });
});
