// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { hydrateBehaviors } from './index';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

const ARTICLE = `
  <div data-sx-toc>
    <nav><div data-sx-panel><a>placeholder</a></div></nav>
    <div data-sx-spy>
      <h2>Getting started</h2>
      <p>…</p>
      <h3>A closer look</h3>
      <p>…</p>
      <h2>Wrapping up</h2>
    </div>
  </div>`;

describe('toc behavior', () => {
  it('builds links from the body headings and slugs their ids (live)', () => {
    const root = mount(ARTICLE);
    const cleanup = hydrateBehaviors(root, { edit: false });
    const links = root.querySelectorAll('[data-sx-panel] a');
    expect(links).toHaveLength(3); // placeholder replaced by the 3 headings
    expect(links[0]!.getAttribute('href')).toBe('#getting-started');
    expect(links[0]!.textContent).toBe('Getting started');
    expect(links[1]!.className).toContain('bx-toc__link--sub'); // the h3 is sub-level
    // The headings got matching ids so the anchors resolve.
    expect(root.querySelector('[data-sx-spy] h2')!.id).toBe('getting-started');
    cleanup();
  });

  it('canvas (edit) leaves the authored placeholder untouched', () => {
    const root = mount(ARTICLE);
    const cleanup = hydrateBehaviors(root, { edit: true });
    const links = root.querySelectorAll('[data-sx-panel] a');
    expect(links).toHaveLength(1);
    expect(links[0]!.textContent).toBe('placeholder');
    cleanup();
  });
});
