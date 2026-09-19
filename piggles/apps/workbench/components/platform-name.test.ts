// A NAME THAT RESOLVES TO NOTHING PRINTS ITSELF IN SOMEBODY'S FOOTER.
//
// The site footer draws a row of marks for the accounts the owner listed. An
// unknown platform is not dropped — it falls back to its own name as text — so a
// name this file fails to resolve does not crash or disappear. It renders the raw
// word "facebook", lowercase, in the middle of a row of icons, and looks like a
// design choice.

import { describe, expect, it } from 'vitest';

import { PLATFORM_KEYS, platformGlyphKey } from './platform-name';

describe('the two vocabularies', () => {
  it('resolves the site-chrome word for a connected-account key', () => {
    // The identity editor writes "facebook"; a connected account is a Facebook
    // PAGE. One drawing, two names, and the footer has to find it from either.
    expect(platformGlyphKey('facebook')).toBe('facebook_page');
    expect(platformGlyphKey('facebook_page')).toBe('facebook_page');
  });

  it('resolves what a person actually types', () => {
    expect(platformGlyphKey('IG')).toBe('instagram');
    expect(platformGlyphKey('Twitter')).toBe('x');
    expect(platformGlyphKey('  YouTube  ')).toBe('youtube');
  });
});

describe('the keys with an underscore in them', () => {
  it('resolves every canonical key as itself', () => {
    // THE POINT: the normalization strips punctuation, so `facebook_page` run
    // through it becomes `facebookpage` and matches nothing. Every connected
    // account on the Social screens is stored under a key like that, and this
    // exact test caught them going blank.
    for (const key of PLATFORM_KEYS) {
      expect(platformGlyphKey(key), key).toBe(key);
    }
  });
});

describe('a name with nothing to draw', () => {
  it('says so rather than guessing', () => {
    // "Other" in the identity editor is a free-text label — a Discord server, a
    // newsletter, a forum. There is no mark for it and there should not be one.
    expect(platformGlyphKey('Discord')).toBe(null);
    expect(platformGlyphKey('')).toBe(null);
  });
});

describe('every offered platform', () => {
  // The identity editor's own list, verbatim. It is presented to the owner as
  // "the platforms a site footer renders an icon for", which is a promise this
  // pins ([[feedback_a_promise_in_copy_is_a_contract]]).
  const OFFERED = [
    'instagram',
    'facebook',
    'x',
    'tiktok',
    'youtube',
    'linkedin',
    'pinterest',
    'threads',
  ];

  it.each(OFFERED)('draws a mark for %s', (platform) => {
    expect(platformGlyphKey(platform)).not.toBe(null);
  });
});

describe('the alias table', () => {
  it('never points at a name with no artwork', () => {
    // This is the failure that would be silent: an alias resolving to a key the
    // mark file has no path for reads as "known" and then draws an empty SVG.
    // The type stops it at compile time; this stops it if the type is ever
    // loosened.
    for (const alias of ['facebook', 'fb', 'twitter', 'ig', 'insta', 'yt', 'li', 'google']) {
      const key = platformGlyphKey(alias);
      expect(key, `${alias} resolved to nothing`).not.toBe(null);
      expect(PLATFORM_KEYS).toContain(key);
    }
  });
});
