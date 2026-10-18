import { describe, expect, it } from 'vitest';
import { shellHasPageTitle } from './shell-page-title';

const el = (tag: string, children: unknown[] = []) => ({ kind: 'element', id: tag, tag, children });

describe('shellHasPageTitle', () => {
  it('finds a page title anywhere in the tree', () => {
    const page = el('div', [el('section', [el('h1', ['Book your truck in']), el('p', ['…'])])]);
    expect(shellHasPageTitle(page)).toBe(true);
  });

  it('says no for a shell that only wraps the block', () => {
    const page = el('div', [
      { kind: 'host', id: 'h', key: 'scheduling.services' },
      el('h2', ['x']),
    ]);
    expect(shellHasPageTitle(page)).toBe(false);
  });

  it('says no when there is no page at all', () => {
    expect(shellHasPageTitle(undefined)).toBe(false);
  });
});
