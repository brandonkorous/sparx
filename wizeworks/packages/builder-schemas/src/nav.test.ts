import { describe, expect, it } from 'vitest';

import { coerceNavLinks, parseNavLinks } from './nav';

describe('parseNavLinks', () => {
  it('parses "Label" and "Label|/url" lines, defaulting the href to #', () => {
    expect(parseNavLinks('Home|/\nShop|/products\nAbout')).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Shop', href: '/products' },
      { label: 'About', href: '#' },
    ]);
  });

  it('trims and drops blank/label-less lines', () => {
    expect(parseNavLinks('  Home | /  \n\n  | /orphan  ')).toEqual([{ label: 'Home', href: '/' }]);
  });
});

describe('coerceNavLinks', () => {
  it('prefers node-owned structured links over a bound value', () => {
    const links = [{ label: 'Home', href: '/' }];
    const bound = [{ label: 'Other', url: '/other' }];
    expect(coerceNavLinks(links, bound)).toEqual([{ label: 'Home', href: '/' }]);
  });

  it('carries openInNewTab and children through, and accepts open_in_new_tab', () => {
    const links = [
      {
        label: 'Docs',
        href: 'https://example.com',
        open_in_new_tab: true,
        children: [{ label: 'API', url: '/api' }],
      },
    ];
    expect(coerceNavLinks(links)).toEqual([
      {
        label: 'Docs',
        href: 'https://example.com',
        openInNewTab: true,
        children: [{ label: 'API', href: '/api' }],
      },
    ]);
  });

  it('falls back to a bound CMS array ({label,url}) when props.links is empty', () => {
    const bound = [
      { label: 'Vehicles', url: '/vehicles' },
      { label: '', url: '/dropme' }, // label-less rows are dropped
    ];
    expect(coerceNavLinks([], bound)).toEqual([{ label: 'Vehicles', href: '/vehicles' }]);
  });

  it('falls back to a legacy hand-typed string when there is no array', () => {
    expect(coerceNavLinks('Home|/\nShop|/products')).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Shop', href: '/products' },
    ]);
  });

  it('returns [] when nothing usable is present', () => {
    expect(coerceNavLinks(undefined)).toEqual([]);
    expect(coerceNavLinks([])).toEqual([]);
    expect(coerceNavLinks([{ href: '/no-label' }])).toEqual([]);
  });
});
