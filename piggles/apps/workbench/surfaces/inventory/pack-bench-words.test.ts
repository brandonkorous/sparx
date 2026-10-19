// Sparx persona issue 356: the pack bench's empty box and short line.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { EMPTY_BOX_WORDS, nobodyFound } from './pack-bench-words';

describe('nobodyFound', () => {
  it('is "it" for one thing only', () => {
    expect(nobodyFound(1, 1)).toBe('it');
    expect(nobodyFound(4, 4)).toBe('any of these');
  });

  it('counts the ones missing when some were found', () => {
    expect(nobodyFound(4, 6)).toBe('4 of these');
  });
});

describe('the pack bench', () => {
  const bench = readFileSync(fileURLToPath(new URL('./pack-bench.tsx', import.meta.url)), 'utf8');

  it('never promises a box to type a quantity in before there is one', () => {
    expect(EMPTY_BOX_WORDS).not.toContain('type a quantity');
    expect(bench).not.toContain('type a quantity against a line below');
    expect(bench).toContain('description={EMPTY_BOX_WORDS}');
  });

  it('says what nobody found with the shared words', () => {
    expect(bench).toContain('nobodyFound(line.shortWhilePicking, line.remaining)');
  });
});

describe('a sealed box', () => {
  const bench = readFileSync(fileURLToPath(new URL('./pack-bench.tsx', import.meta.url)), 'utf8');

  // The order has no label to buy: it sends the box by saying who took it
  // (sparx persona issue 357).
  it('is sent from the order, as the order offers it', () => {
    expect(bench).not.toContain('Buy a label from the order');
    expect(bench).toContain('Send it from the order: say who took it when it goes.');
  });
});
