// The quote line editor's boxes read what an owner types and show what they hold
// (sparx persona issue 086): no number field for money, no "0.00" over an empty
// cost, and quantity boxes wide enough for a wholesale 1000.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(resolve(HERE, name), 'utf8');
const NUMBERS = read('line-editor-numbers.tsx');
const MARKUP = read('line-editor-markup.tsx');
const ROW = read('line-items.tsx');
const ROW_PARTS = read('line-row-parts.tsx');

/** Every `<Tag … />` element's text, read to its own `/>` by brace depth. */
function elements(source: string, tag: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(new RegExp(`<${tag}\\b`, 'g'))) {
    let depth = 0;
    for (let i = match.index; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      else if (depth === 0 && ch === '/' && source[i + 1] === '>') {
        found.push(source.slice(match.index, i + 2));
        break;
      }
    }
  }
  return found;
}

const valueOf = (el: string) => /\svalue=\{([^}]*)\}/.exec(el)?.[1]?.trim() ?? '';
const cost = () => elements(NUMBERS, 'MoneyInput').find((el) => el.includes('"Cost to you"'));

describe('the line editor', () => {
  it('takes the cost as money that can be left blank', () => {
    expect(cost()).toBeDefined();
    expect(cost()).toMatch(/\soptional[\s/]/);
  });

  it('shows an empty cost as empty, with no 0.00 standing in for it', () => {
    expect(cost()).toBeDefined();
    expect(cost()).not.toMatch(/placeholder=/);
  });

  it('has no browser number field but the quantity', () => {
    const inputs = [NUMBERS, MARKUP, ROW].flatMap((source) => elements(source, 'Input'));
    expect(inputs.length).toBeGreaterThanOrEqual(4);
    const numberFields = inputs.filter((el) => el.includes('type="number"')).map(valueOf);
    expect(numberFields.sort()).toEqual(['form.quantity', 'line.quantity']);
  });
});

/** Five digits at 14px (a digit is at most 0.62em), Piggles' small-input
 *  padding (0.75rem each side), a 2px border, and ~16px of number arrows. */
const SMALL_QTY = 5 * 14 * 0.62 + 2 * 12 + 2 + 16;
/** The same at the default size: 16px type, 0.9rem padding each side. */
const MEDIUM_QTY = 5 * 16 * 0.62 + 2 * 14.4 + 2 + 16;

describe('the quantity boxes', () => {
  it('on the line row fit four digits with room', () => {
    const track = /grid-cols-\[minmax\(0,1fr\)_([\d.]+)rem_/.exec(ROW_PARTS)?.[1];
    expect(track).toBeDefined();
    expect(Number(track) * 16).toBeGreaterThanOrEqual(SMALL_QTY);
  });

  it('in the editor fit four digits with room', () => {
    const width = /<Field className="w-(\d+)">\s*<FieldLabel required>Qty</.exec(NUMBERS)?.[1];
    expect(width).toBeDefined();
    expect(Number(width) * 4).toBeGreaterThanOrEqual(MEDIUM_QTY);
  });
});
