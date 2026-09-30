import { describe, expect, it } from 'vitest';

import { namedFew, untouchedLabel, type UntouchedArtifact } from './blueprints-untouched';

/**
 * A NATURAL KEY IS NOT A SENTENCE.
 *
 * The server answers with the manifest's own correlation keys — `slug:about`,
 * `blog_post:launch-your-store-in-a-weekend`, `rowan-enamel-mug` — and the panel
 * on Home puts them in front of a business owner. A screen that prints a key at
 * somebody is the thing this console's vocabulary file exists to stop.
 */

const of = (kind: UntouchedArtifact['kind'], naturalKey: string): UntouchedArtifact => ({
  kind,
  naturalKey,
  refId: null,
});

describe('untouchedLabel', () => {
  it('calls the home page the home page, not "home"', () => {
    expect(untouchedLabel(of('page', 'home'))).toBe('your home page');
  });

  it('uses a page name she would recognise', () => {
    expect(untouchedLabel(of('page', 'slug:about'))).toBe('About');
    expect(untouchedLabel(of('page', 'slug:blog'))).toBe('Journal');
  });

  it('de-slugs a page nobody named, rather than printing the slug', () => {
    expect(untouchedLabel(of('page', 'slug:our-story'))).toBe('Our story');
  });

  it('drops the type off an article key', () => {
    expect(untouchedLabel(of('content', 'blog_post:launch-your-store-in-a-weekend'))).toBe(
      'Launch your store in a weekend'
    );
  });

  it('reads a product handle as a title', () => {
    expect(untouchedLabel(of('product', 'rowan-enamel-mug'))).toBe('Rowan enamel mug');
  });

  it('never answers with an empty string', () => {
    // An empty name in the middle of a sentence reads as a rendering fault, and
    // the sentence is the whole panel.
    expect(untouchedLabel(of('product', ''))).toBe('Untitled');
  });
});

describe('namedFew', () => {
  it('names one', () => {
    expect(namedFew([of('product', 'rowan-enamel-mug')])).toBe('Rowan enamel mug');
  });

  it('joins two with "and", not a comma', () => {
    expect(namedFew([of('product', 'one-thing'), of('product', 'two-thing')])).toBe(
      'One thing and Two thing'
    );
  });

  it('names three', () => {
    expect(
      namedFew([of('product', 'a-thing'), of('product', 'b-thing'), of('product', 'c-thing')])
    ).toBe('A thing, B thing and C thing');
  });

  it('names three and counts the rest, spending "and" exactly once', () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((h) => of('product', `${h}-thing`));
    expect(namedFew(six)).toBe('A thing, B thing, C thing and 3 more');
  });

  it('says nothing when there is nothing', () => {
    expect(namedFew([])).toBe('');
  });
});
