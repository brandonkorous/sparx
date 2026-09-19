// A NETWORK PICKED FROM A MENU MUST NOT LAND IN A FOOTER AS A LOWERCASE KEY.
//
// Site identity offers ten networks under the heading "the platforms a site footer
// renders a first-class icon for". Eight have a glyph here. The other two fell
// through to `item.platform`, so an owner who chose "WhatsApp" from the list got
// the word `whatsapp` sitting among a row of round icon buttons, and there was
// nothing on her screen to say why.

import { describe, expect, it } from 'vitest';

import { socialLabel } from './social-links';

describe('a platform with no glyph', () => {
  it('is named the way the editor named it', () => {
    expect(socialLabel('whatsapp')).toBe('WhatsApp');
    expect(socialLabel('bluesky')).toBe('Bluesky');
  });

  it('is never printed as a bare key', () => {
    // The point of the fix stated as a rule: whatever the editor offers, what
    // reaches the footer is a name a person would write.
    for (const platform of ['whatsapp', 'bluesky']) {
      expect(socialLabel(platform)).not.toBe(platform);
      expect(socialLabel(platform)).toMatch(/^[A-Z]/);
    }
  });
});

describe('a platform the owner typed herself', () => {
  it('keeps her own words', () => {
    // "Other" in the editor carries a free-text label as the platform, so this
    // string IS what she wrote. Re-capitalizing it would be second-guessing her.
    expect(socialLabel('Ravelry')).toBe('Ravelry');
    expect(socialLabel('my knitting group')).toBe('my knitting group');
  });
});

describe('the names a person shortens things to', () => {
  it('normalizes before looking, the way the glyph lookup does', () => {
    // These resolve to platforms that DO have a glyph, so the label is never
    // reached on a real site. Pinned anyway: the two lookups share one
    // normalization, and a change to it must not move only one of them.
    expect(socialLabel('WhatsApp')).toBe('WhatsApp');
    expect(socialLabel('Whats App')).toBe('WhatsApp');
  });
});
