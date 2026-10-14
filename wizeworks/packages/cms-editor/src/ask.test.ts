import { describe, expect, it } from 'vitest';
import { getExtensionField } from '@tiptap/core';
import { cmsEditorExtensions } from './extensions';
import { readHref, searchesPages } from './ask';
import source from './editor.tsx?raw';

describe('readHref', () => {
  it('keeps an address that is already whole', () => {
    expect(readHref('/articles/a-correction')).toEqual({ href: '/articles/a-correction' });
    expect(readHref(' https://example.com/x ')).toEqual({ href: 'https://example.com/x' });
    expect(readHref('#notes')).toEqual({ href: '#notes' });
  });

  it('finishes the address she meant', () => {
    expect(readHref('marrowreview.co.uk/about')).toEqual({
      href: 'https://marrowreview.co.uk/about',
    });
    expect(readHref('editors@marrowreview.co.uk')).toEqual({
      href: 'mailto:editors@marrowreview.co.uk',
    });
  });

  it('takes the link off when the box is emptied', () => {
    expect(readHref('   ')).toEqual({ href: null });
  });

  it('refuses words that are not an address, and says what to type', () => {
    const read = readHref('the last mill');
    expect('error' in read && read.error).toMatch(/Paste a full address/);
    expect('error' in readHref('/articles/the last mill')).toBe(true);
  });
});

describe('searchesPages', () => {
  it('searches a title and not a pasted address', () => {
    expect(searchesPages('last mill')).toBe(true);
    expect(searchesPages('/articles/x')).toBe(false);
    expect(searchesPages('example.com')).toBe(false);
    expect(searchesPages('m')).toBe(false);
  });
});

// P09: "Link URL" was a browser prompt. The editor must ask in the page.
describe('the editor toolbar', () => {
  it('never asks through a browser prompt', () => {
    expect(source).not.toMatch(/window\.(prompt|alert|confirm)\(/);
    expect(source).toContain('<AskBar');
  });
});

// P09: a full stop typed after a new link joined the link.
describe('a link', () => {
  it('ends where it ends, so typing after it is plain text', () => {
    const link = cmsEditorExtensions({}).find((extension) => extension.name === 'link');
    expect(link).toBeDefined();
    const inclusive = getExtensionField<boolean | (() => boolean)>(link!, 'inclusive', {
      name: link!.name,
      options: link!.options,
      storage: link!.storage,
    });
    expect(typeof inclusive === 'function' ? inclusive() : inclusive).toBe(false);
  });
});
