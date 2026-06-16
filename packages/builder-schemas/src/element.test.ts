import { describe, expect, it } from 'vitest';

import {
  isRawContainerType,
  isRawElementType,
  isRawVoidType,
  rawElementText,
  rawElementType,
  rawTagAcceptsInlineChrome,
  rawTagOf,
  safeElementAttrs,
} from './element';

describe('raw element type helpers', () => {
  it('resolves whitelisted tags from the el: prefix', () => {
    expect(isRawElementType('el:div')).toBe(true);
    expect(rawTagOf('el:section')).toBe('section');
    expect(rawElementType('nav')).toBe('el:nav');
  });

  it('rejects non-whitelisted + dangerous tags', () => {
    for (const bad of [
      'el:script',
      'el:style',
      'el:iframe',
      'el:object',
      'el:',
      'Section',
      'el:bogus',
    ]) {
      expect(isRawElementType(bad)).toBe(false);
      expect(rawTagOf(bad)).toBeNull();
    }
  });

  it('classifies container vs leaf vs void', () => {
    expect(isRawContainerType('el:div')).toBe(true);
    expect(isRawContainerType('el:ul')).toBe(true);
    expect(isRawContainerType('el:span')).toBe(false); // text leaf
    expect(isRawVoidType('el:img')).toBe(true);
    expect(isRawVoidType('el:br')).toBe(true);
    expect(isRawVoidType('el:div')).toBe(false);
  });

  it('only injects canvas chrome where the tag allows flow children', () => {
    expect(rawTagAcceptsInlineChrome('el:div')).toBe(true);
    expect(rawTagAcceptsInlineChrome('el:ul')).toBe(false); // restricted parent
    expect(rawTagAcceptsInlineChrome('el:table')).toBe(false);
    expect(rawTagAcceptsInlineChrome('el:svg')).toBe(false);
    expect(rawTagAcceptsInlineChrome('el:img')).toBe(false); // void
  });
});

describe('safeElementAttrs (the render-time security gate)', () => {
  const attrs = (type: string, props: Record<string, unknown>) => safeElementAttrs({ type, props });

  it('keeps whitelisted attributes for the tag, drops the rest', () => {
    const out = attrs('el:a', { href: '/shop', alt: 'nope', onclick: 'steal()', foo: 'bar' });
    expect(out).toEqual({ href: '/shop' });
  });

  it('maps prop keys to their React attribute names', () => {
    expect(attrs('el:label', { for: 'email' })).toEqual({ htmlFor: 'email' });
    expect(attrs('el:img', { src: 'https://x/a.png', srcset: 'a 1x' })).toMatchObject({
      src: 'https://x/a.png',
      srcSet: 'a 1x',
    });
  });

  it('scheme-checks href/src — blocks javascript: and data:', () => {
    expect(attrs('el:a', { href: 'javascript:alert(1)' })).toEqual({});
    expect(attrs('el:img', { src: 'data:text/html,evil' })).toEqual({});
    expect(attrs('el:a', { href: 'https://ok.test' })).toEqual({ href: 'https://ok.test' });
    expect(attrs('el:a', { href: '#anchor' })).toEqual({ href: '#anchor' });
  });

  it('forces rel=noopener on target=_blank', () => {
    expect(attrs('el:a', { href: '/x', target: '_blank' })).toEqual({
      href: '/x',
      target: '_blank',
      rel: 'noopener noreferrer',
    });
  });

  it('coerces booleans and authors form value as uncontrolled defaultValue', () => {
    expect(attrs('el:input', { disabled: true, value: 'hi' })).toEqual({
      disabled: true,
      defaultValue: 'hi',
    });
    expect(attrs('el:details', { open: 'true' })).toEqual({ open: true });
    // a non-form value keeps the value attribute (e.g. an <option>)
    expect(attrs('el:option', { value: 'x' })).toEqual({ value: 'x' });
  });
});

describe('rawElementText', () => {
  it('returns inline text only for text-bearing tags', () => {
    expect(rawElementText({ type: 'el:p', props: { text: 'hello' } })).toBe('hello');
    expect(rawElementText({ type: 'el:div', props: { text: 'hello' } })).toBe('');
    expect(rawElementText({ type: 'el:img', props: { text: 'hello' } })).toBe('');
  });
});
