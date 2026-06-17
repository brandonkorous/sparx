// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { hydrateBehaviors } from './index';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

const STATS = `
  <div data-sx-counter>
    <div data-sx-item>10,000+</div>
    <div data-sx-item>98%</div>
    <div data-sx-item>$2.4M</div>
    <div data-sx-item>4.9</div>
  </div>`;

describe('counter behavior', () => {
  it('canvas (edit) keeps the authored final values — no animation', () => {
    const root = mount(STATS);
    const cleanup = hydrateBehaviors(root, { edit: true });
    const items = root.querySelectorAll('[data-sx-item]');
    expect(items[0]!.textContent).toBe('10,000+');
    expect(items[1]!.textContent).toBe('98%');
    expect(items[2]!.textContent).toBe('$2.4M');
    expect(items[3]!.textContent).toBe('4.9');
    cleanup();
  });

  it('live resets each value to zero up front, preserving prefix/suffix + formatting', () => {
    const root = mount(STATS);
    // Reset-to-zero is synchronous; the count-up runs once the root scrolls in.
    const cleanup = hydrateBehaviors(root, { edit: false });
    const items = root.querySelectorAll('[data-sx-item]');
    expect(items[0]!.textContent).toBe('0+'); // thousands grouping preserved
    expect(items[1]!.textContent).toBe('0%'); // suffix preserved
    expect(items[2]!.textContent).toBe('$0.0M'); // prefix + one decimal preserved
    expect(items[3]!.textContent).toBe('0.0'); // decimal precision preserved
    cleanup();
  });

  it('ignores a root with no numeric items', () => {
    const root = mount('<div data-sx-counter><div data-sx-item>none</div></div>');
    const cleanup = hydrateBehaviors(root, { edit: false });
    expect(root.querySelector('[data-sx-item]')!.textContent).toBe('none');
    cleanup();
  });
});
