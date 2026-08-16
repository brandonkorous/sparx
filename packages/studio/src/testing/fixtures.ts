// Fixtures for the package's own tests. Not exported from `index.ts` — nothing
// outside this package should be able to mint a document that skipped the loader.

import type { ElementNode, Node, Theme } from '@wizeworks/silicaui-html';
import type { ComponentDoc, LayoutDoc, PageDoc, ThemeDoc } from '../documents/types';

export function el(id: string, children: (Node | string)[] = [], tag = 'div'): ElementNode {
  return { kind: 'element', id, tag, children };
}

export const THEME: Theme = {
  name: 'test',
  tokens: { '--color-primary': '#FF6F86', '--radius-field': '0.5rem' },
};

export function themeDoc(overrides: Partial<ThemeDoc> = {}): ThemeDoc {
  return {
    kind: 'theme',
    id: 'theme-1',
    name: 'House',
    rev: 1,
    publishedAt: null,
    unpublished: true,
    origin: 'tenant',
    tenantId: 'tenant-1',
    marketplaceThemeId: null,
    marketplaceVersion: null,
    theme: THEME,
    ...overrides,
  };
}

/** A layout whose Outlet sits between a header and a footer. */
export function layoutDoc(overrides: Partial<LayoutDoc> = {}): LayoutDoc {
  return {
    kind: 'layout',
    id: 'layout-1',
    name: 'Site chrome',
    rev: 1,
    publishedAt: null,
    unpublished: true,
    propertyId: 'property-1',
    root: el('frame-root', [
      el('header', [el('brand', ['Bakery'], 'span')], 'header'),
      { kind: 'outlet' },
      el('footer', [el('legal', ['© Bakery'], 'span')], 'footer'),
    ]),
    ...overrides,
  };
}

export function pageDoc(overrides: Partial<PageDoc> = {}): PageDoc {
  return {
    kind: 'page',
    id: 'page-1',
    name: 'Home',
    rev: 1,
    publishedAt: null,
    unpublished: true,
    propertyId: 'property-1',
    slug: '',
    pageKind: 'singleton',
    recordType: null,
    recordSubtype: null,
    isDefault: false,
    frame: null,
    seo: { title: null, description: null, canonical: null, ogImage: null, noindex: false },
    root: el('body-root', [el('hero', [el('title', ['Fresh bread'], 'h1')], 'section')]),
    ...overrides,
  };
}

export function componentDoc(overrides: Partial<ComponentDoc> = {}): ComponentDoc {
  return {
    kind: 'component',
    id: 'component-1',
    name: 'Opening hours',
    rev: 1,
    publishedAt: null,
    unpublished: true,
    propertyId: 'property-1',
    root: el('hours-root', [el('hours-text', ['Mon–Sat, 7–4'], 'p')]),
    ...overrides,
  };
}
