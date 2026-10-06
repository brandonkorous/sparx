// The quote line editor's boxes read what an owner types, and show what they
// hold (sparx persona issue 086).
//
// "Cost to you" was a browser number field. A number field hands "8,50" to the
// page as nothing at all, so a cost typed with a comma silently became "no cost"
// and the margin it was typed for never appeared. Empty, it also showed a grey
// "0.00", which reads as a measured cost of nothing. The ad-hoc markup box had
// the first problem for every method, a fixed $ amount included.
//
// And the line row's Qty column was 3.5rem: once a small input's padding,
// border and a number field's up/down arrows are taken out, 19px were left for
// digits, so a wholesale quantity of 100 showed as "10(".
//
// Read from the source, like money-blank.test.ts, because the defects are in
// what the editor hands its fields, and each scan asserts it found its target.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const EDITOR = readFileSync(resolve(HERE, 'line-editor-modal.tsx'), 'utf8');
const ROW = readFileSync(resolve(HERE, 'line-items.tsx'), 'utf8');

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

function valueOf(element: string): string {
  return /\svalue=\{([^}]*)\}/.exec(element)?.[1]?.trim() ?? '';
}

describe('the line editor', () => {
  it('takes the cost as money that can be left blank', () => {
    const cost = elements(EDITOR, 'MoneyInput').filter((el) => el.includes('"Cost to you"'));
    expect(cost).toHaveLength(1);
    expect(cost[0]).toMatch(/\soptional[\s/]/);
  });

  it('shows an empty cost as empty, with no 0.00 standing in for it', () => {
    const cost = elements(EDITOR, 'MoneyInput').find((el) => el.includes('"Cost to you"'));
    // Found first, or this would pass over a field that is not there.
    expect(cost).toBeDefined();
    expect(cost).not.toMatch(/placeholder=/);
  });

  it('has no browser number field but the quantity', () => {
    const inputs = [...elements(EDITOR, 'Input'), ...elements(ROW, 'Input')];
    // The denominator: the description, quantity and markup boxes at least.
    expect(inputs.length).toBeGreaterThanOrEqual(4);
    const numberFields = inputs.filter((el) => el.includes('type="number"')).map(valueOf);
    expect(numberFields.sort()).toEqual(['form.quantity', 'line.quantity']);
  });
});

/**
 * The width a quantity box needs, in px: five digits (a case of 1000 and room
 * to spare) at silica's small size (14px, a digit is at most 0.62em), its side
 * padding (0.625rem each side in sparx), a 2px border, and the ~16px Chrome
 * keeps for a number field's arrows.
 */
function smallQtyWidth(): number {
  return 5 * 14 * 0.62 + 2 * 10 + 2 + 16;
}

/** The same at the default size the editor's own Qty box uses: 16px type and
 *  0.75rem padding each side. */
function mediumQtyWidth(): number {
  return 5 * 16 * 0.62 + 2 * 12 + 2 + 16;
}

describe('the quantity boxes', () => {
  it('on the line row fit four digits with room', () => {
    const track = /grid-cols-\[minmax\(0,1fr\)_([\d.]+)rem_/.exec(ROW)?.[1];
    expect(track).toBeDefined();
    expect(Number(track) * 16).toBeGreaterThanOrEqual(smallQtyWidth());
  });

  it('in the editor fit four digits with room', () => {
    const width = /<Field className="w-(\d+)">\s*<FieldLabel required>Qty</.exec(EDITOR)?.[1];
    expect(width).toBeDefined();
    expect(Number(width) * 4).toBeGreaterThanOrEqual(mediumQtyWidth());
  });
});
