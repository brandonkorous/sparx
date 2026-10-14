// The table where the owner decides about returned goods names them in words
// (sparx persona issues 180, 181 and 182). Brynn's injector came back "As new",
// and the table said "like new"; its name was cut to "Bosch Reman…"; and her "It
// does not fit" read "Wrong size" to Doty.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REASON_LABELS } from './returns-words';

const panel = readFileSync(
  fileURLToPath(new URL('./return-disposition-panel.tsx', import.meta.url)),
  'utf8'
);

describe('what happens to the goods', () => {
  it('says the condition the owner picked, never its code', () => {
    expect(panel).toContain('conditionLabel(row.condition)');
    expect(panel).not.toMatch(/row\.condition\.replace\(/);
  });

  it('lets the item name wrap instead of cutting it off', () => {
    expect(panel).not.toMatch(/<td className="max-w-0">/);
  });
});

describe('why it came back', () => {
  it('says a part does not fit, the way the customer said it', () => {
    expect(REASON_LABELS.wrong_size).toBe('Does not fit');
  });
});
