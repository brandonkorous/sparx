import { describe, expect, it } from 'vitest';
import { fieldKey } from './settings-tab';

// Every box in the Settings tab is uncontrolled: it holds what it was mounted
// with and writes on blur. React only remounts it when its key changes, so the
// key is the ONLY thing standing between a box and a value that moved under it.

describe('fieldKey', () => {
  it('changes when the value changes, so the box remounts holding the truth', () => {
    const before = fieldKey('n1', 'text', 'Get a quote');
    const after = fieldKey('n1', 'text', 'Ask about a cake');
    expect(after).not.toBe(before);
  });

  it('is stable while the value is not moving, so typing is never interrupted', () => {
    expect(fieldKey('n1', 'text', 'Ask about a cake')).toBe(
      fieldKey('n1', 'text', 'Ask about a cake')
    );
  });

  it('separates two fields on one node, so alt does not remount src', () => {
    expect(fieldKey('n1', 'src', '/a.jpg')).not.toBe(fieldKey('n1', 'alt', '/a.jpg'));
  });

  it('separates the same field on two nodes', () => {
    expect(fieldKey('n1', 'text', 'Prices')).not.toBe(fieldKey('n2', 'text', 'Prices'));
  });

  // An empty value is a real state — a heading cleared on the canvas — and must
  // still remount the box rather than leave the old words sitting in it.
  it('treats emptying a value as a change', () => {
    expect(fieldKey('n1', 'text', '')).not.toBe(fieldKey('n1', 'text', 'Prices'));
  });
});
