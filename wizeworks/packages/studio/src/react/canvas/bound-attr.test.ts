import { describe, expect, it } from 'vitest';
import type { Node } from '@wizeworks/silicaui-html';

// The rule the canvas draws bindings by, stated as data so it can be checked
// without a DOM: a binding that names an ATTRIBUTE fills that attribute, and a
// binding that names none replaces the words.
//
// It mattered on a real page. A starter Contact page's link binds
// `site.identity.phoneHref` into `href` and holds the number as its words; the
// canvas drew the resolved href AS the words, so the page read
// "tel:01632960118" where the phone number belonged — but only once the owner
// had filled her number in, because until then the binding resolved to nothing
// and the words were left alone.

const bind = (ref: string, attr?: string): Node => ({
  kind: 'element',
  tag: 'a',
  id: 'a1',
  children: ['01632 960 118'],
  data: attr ? { kind: 'value', ref, attr } : { kind: 'value', ref },
});

/** Mirrors `boundText` in render-node.tsx. */
function textOf(node: Node, resolve: (ref: string) => string | undefined): string | undefined {
  const data = (node as { data?: { kind: string; ref: string; attr?: string } }).data;
  if (data?.kind !== 'value' || data.attr) return undefined;
  return resolve(data.ref);
}

/** Mirrors `boundAttr` in render-node.tsx. */
function attrOf(node: Node, resolve: (ref: string) => string | undefined) {
  const data = (node as { data?: { kind: string; ref: string; attr?: string } }).data;
  if (data?.kind !== 'value' || !data.attr) return undefined;
  const value = resolve(data.ref);
  return value === undefined ? undefined : { key: data.attr, value };
}

const resolve = (ref: string): string | undefined =>
  ({ 'site.identity.phoneHref': 'tel:01632960118', 'site.identity.name': 'Thistle & Rye' })[ref];

describe('a binding that names an attribute', () => {
  it('fills the attribute', () => {
    expect(attrOf(bind('site.identity.phoneHref', 'href'), resolve)).toEqual({
      key: 'href',
      value: 'tel:01632960118',
    });
  });

  it('leaves the words alone', () => {
    expect(textOf(bind('site.identity.phoneHref', 'href'), resolve)).toBeUndefined();
  });
});

describe('a binding that names no attribute', () => {
  it('replaces the words', () => {
    expect(textOf(bind('site.identity.name'), resolve)).toBe('Thistle & Rye');
  });

  it('fills no attribute', () => {
    expect(attrOf(bind('site.identity.name'), resolve)).toBeUndefined();
  });
});

describe('a binding that resolves to nothing', () => {
  it('leaves both alone, so the authored words still show', () => {
    expect(textOf(bind('site.identity.tagline'), resolve)).toBeUndefined();
    expect(attrOf(bind('site.identity.emailHref', 'href'), resolve)).toBeUndefined();
  });
});
