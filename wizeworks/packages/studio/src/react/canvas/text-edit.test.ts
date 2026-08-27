import { describe, expect, it } from 'vitest';
import { swallowsSpace } from './text-edit';

/** A stand-in for a canvas element, with only what `swallowsSpace` reads. */
function element(tag: string, role?: string): HTMLElement {
  return {
    tagName: tag.toUpperCase(),
    getAttribute: (name: string) => (name === 'role' ? (role ?? null) : null),
  } as unknown as HTMLElement;
}

describe('which controls eat the space bar', () => {
  it('claims the ones whose own keyboard contract is activation', () => {
    // The FAQ block's question is a `<button>`, so "How do I swap something for
    // a different size?" was typed into a live site as "HowdoIswapsomethingfora
    // differentsize?" — every space activating the accordion instead of landing
    // (issue 264). Nothing errored and nothing warned.
    expect(swallowsSpace(element('button'))).toBe(true);
    expect(swallowsSpace(element('summary'))).toBe(true);
    expect(swallowsSpace(element('div', 'button'))).toBe(true);
    expect(swallowsSpace(element('div', 'switch'))).toBe(true);
  });

  it('leaves ordinary words to the browser', () => {
    // Faking the space everywhere would be worse than the bug: the browser knows
    // when a space at the end of a line has to hold its width, and we do not.
    for (const tag of ['h1', 'h2', 'p', 'span', 'li', 'div', 'td', 'a']) {
      expect(swallowsSpace(element(tag)), `${tag} does not need faking`).toBe(false);
    }
    expect(swallowsSpace(element('div', 'heading'))).toBe(false);
  });
});
