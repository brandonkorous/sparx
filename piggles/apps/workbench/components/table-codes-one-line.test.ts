// A code in a table stays on one line (sparx persona issue 238).
//
// A monospace table cell holds a code: an order, invoice, document, gift card,
// unit or SKU number. The browser breaks a line at a hyphen, so on a phone
// "O-000033" rendered as "O-" over "000033". Every table in the console renders
// through components/table.tsx, so the default lives there, once.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const table = readFileSync(fileURLToPath(new URL('./table.tsx', import.meta.url)), 'utf8');

describe('a code in a table', () => {
  it('is held to one line by the shared Table', () => {
    expect(table).toContain("'[&_td.font-mono:not(.tabular-nums)]:whitespace-nowrap'");
    expect(table).toMatch(
      /className=\{className \? `\$\{CODES_ON_ONE_LINE\} \$\{className\}` : CODES_ON_ONE_LINE\}/
    );
  });
});
