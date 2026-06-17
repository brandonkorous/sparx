// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { hydrateBehaviors } from './index';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

const BANNER = `
  <div data-sx-dismiss data-sx-key="cookie-consent">
    <p>We use cookies.</p>
    <button data-sx-trigger>Accept all</button>
    <button data-sx-trigger>Essential only</button>
  </div>`;

afterEach(() => {
  localStorage.clear();
});

describe('dismiss behavior', () => {
  it('hides the banner on a trigger click and remembers it', () => {
    const root = mount(BANNER);
    const cleanup = hydrateBehaviors(root, { edit: false });
    expect(root.hidden).toBe(false);
    root.querySelector<HTMLElement>('[data-sx-trigger]')!.click();
    expect(root.hidden).toBe(true);
    expect(localStorage.getItem('sx-dismissed:cookie-consent')).toBe('1');
    cleanup();
  });

  it('stays hidden on a later visit once dismissed', () => {
    localStorage.setItem('sx-dismissed:cookie-consent', '1');
    const root = mount(BANNER);
    const cleanup = hydrateBehaviors(root, { edit: false });
    expect(root.hidden).toBe(true); // hidden up front, no click needed
    cleanup();
  });

  it('canvas (edit) keeps the banner visible and the triggers inert', () => {
    const root = mount(BANNER);
    const cleanup = hydrateBehaviors(root, { edit: true });
    root.querySelector<HTMLElement>('[data-sx-trigger]')!.click();
    expect(root.hidden).toBe(false);
    expect(localStorage.getItem('sx-dismissed:cookie-consent')).toBeNull();
    cleanup();
  });
});
