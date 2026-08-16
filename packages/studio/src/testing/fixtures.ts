// Fixtures for the package's own tests. Not exported from `index.ts` — nothing
// outside this package should be able to mint a document that skipped the loader.

import type { ElementNode, Node, Theme } from '@wizeworks/silicaui-html';
import type {
  ButtonNode,
  ColumnNode,
  ColumnsNode,
  EmailBody,
  SectionNode,
  TextNode,
} from '@wizeworks/silicaui-builder/email';
import type { ComponentDoc, EmailDoc, LayoutDoc, PageDoc, ThemeDoc } from '../documents/types';

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

export function emailText(id: string, html: string): TextNode {
  // `lineHeight` is a PX count, not a ratio — see `TextNode`.
  return {
    kind: 'text',
    id,
    html,
    align: 'left',
    color: '#111827',
    fontSize: 16,
    fontWeight: 'normal',
    lineHeight: 24,
  };
}

export function emailButton(id: string, label: string): ButtonNode {
  return {
    kind: 'button',
    id,
    label,
    href: 'https://example.test',
    bg: '#FF6F86',
    color: '#FFFFFF',
    radius: 8,
    align: 'center',
    paddingX: 20,
    paddingY: 12,
  };
}

export function emailSection(id: string, children: SectionNode['children']): SectionNode {
  return { kind: 'section', id, bg: '#FFFFFF', paddingX: 24, paddingY: 24, children };
}

export function emailColumns(id: string, columns: ColumnNode[]): ColumnsNode {
  return { kind: 'columns', id, children: columns, stackOnMobile: true };
}

export function emailColumn(id: string, children: ColumnNode['children']): ColumnNode {
  return { kind: 'column', id, widthPct: 50, children };
}

/** A body of two sections — the second a two-column row — so a fixture exercises
 *  every nesting rule `canHold` adjudicates. */
export function emailBody(): EmailBody {
  return {
    kind: 'body',
    id: 'body',
    width: 600,
    bg: '#F3F4F6',
    contentBg: '#FFFFFF',
    fontFamily: 'system-ui, sans-serif',
    children: [
      emailSection('intro', [emailText('greeting', 'Hello there')]),
      emailSection('row', [
        emailColumns('cols', [
          emailColumn('left', [emailText('left-copy', 'Left')]),
          emailColumn('right', [emailButton('cta', 'Order again')]),
        ]),
      ]),
    ],
  };
}

export function emailDoc(overrides: Partial<EmailDoc> = {}): EmailDoc {
  return {
    kind: 'email',
    id: 'email-1',
    name: 'Order confirmation',
    rev: 1,
    publishedAt: null,
    unpublished: true,
    document: {
      version: '1',
      subject: 'Your order is on its way',
      preheader: 'Thanks for shopping with us',
      root: emailBody(),
    },
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
