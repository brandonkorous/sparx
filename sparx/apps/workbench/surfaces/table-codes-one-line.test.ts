// A code in a table stays on one line (sparx persona issue 238).
//
// A monospace table cell holds a code: an order, invoice, document, gift card,
// unit or SKU number. The browser breaks a line at a hyphen, and a code column
// gets what is left after the others take their width, so on a phone "O-000033"
// rendered as "O-" over "000033". Selling › Orders carried `whitespace-nowrap`
// for exactly this; thirteen other tables did not. A code that does not fit
// scrolls the table instead.
//
// Every table is read here, so the next one written cannot miss it. A figure
// (`tabular-nums`) is not a code: it has no hyphen to break at, and one of them,
// a company's credit "$9,882.08 of $10,000.00", wraps its "of" line on purpose.
// `truncate` already holds a cell to one line.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));

function tsxUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name.startsWith('.')) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxUnder(path);
    return name.endsWith('.tsx') ? [path] : [];
  });
}

const CODE_CELL = /<td className="([^"]*\bfont-mono\b[^"]*)"/g;

function brokenCells(): string[] {
  return ['surfaces', 'components'].flatMap((dir) =>
    tsxUnder(join(root, dir)).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(CODE_CELL)]
        .filter((match) => !/\b(whitespace-nowrap|truncate|tabular-nums)\b/.test(match[1] ?? ''))
        .map((match) => `${file.slice(root.length)}: ${match[0]}`)
    )
  );
}

describe('a code in a table', () => {
  it('is never broken across lines', () => {
    expect(brokenCells()).toEqual([]);
  });
});
