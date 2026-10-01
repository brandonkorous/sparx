// Every money field selects what it holds when a person clicks into it.
//
// A money field opens holding a settled amount, "1200.00". A click drops the
// caret somewhere inside it, so typing a new amount mixes the two: on the deal
// form, 1,250 typed into 1200.00 saved a deal worth $1,200,001.25 (issue 914).
// `MoneyInput` and `MoneyCentsInput` select on focus for exactly this reason
// (issues 169 and 205). `MoneyTextInput`, between them, did not, and it is the
// one 46 screens use.
//
// Read from the source because the rule is about all three fields in one file,
// and a .ts test cannot render a .tsx component here. It counts the fields it
// found so it cannot go green over an empty read.
// [[feedback_structural_checks_go_blind]]

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'money-input.tsx'),
  'utf8'
);

/** Each exported component that draws an input, with its body. */
function moneyFields(): { name: string; body: string }[] {
  return SOURCE.split(/^export function /m)
    .slice(1)
    .map((chunk) => ({ name: chunk.slice(0, chunk.indexOf('(')), body: chunk }))
    .filter((field) => field.body.includes('<Input'));
}

describe('money fields', () => {
  it('finds all three', () => {
    expect(moneyFields().map((field) => field.name)).toEqual([
      'MoneyInput',
      'MoneyTextInput',
      'MoneyCentsInput',
    ]);
  });

  it('select what they hold on focus', () => {
    const missing = moneyFields()
      .filter(
        (field) => !/onFocus=\{\(event\) => \{[\s\S]*?event\.target\.select\(\);/.test(field.body)
      )
      .map((field) => field.name);
    expect(missing).toEqual([]);
  });
});
