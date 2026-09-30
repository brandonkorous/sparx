// What a file's size says when nobody measured it (issue 380).
//
// `byte_size = 0` is not a weight. No file is zero bytes, so that column only
// ever means the size was never recorded — and 74 of Devi's 87 photographs
// carried it, every one printing a confident "0 bytes" under its thumbnail.
// Issue 330 settled the same rule for the publish weight report; these pin it
// for the library screen.

import { describe, expect, it } from 'vitest';

import { formatBytes, sizeLabel, usedInLabel } from './media-admin';

const asset = (byteSize: number | null, linked = false) => ({ byteSize, linked });

describe('sizeLabel', () => {
  describe('a real measurement is printed as one', () => {
    it('prints bytes under a kilobyte', () => {
      expect(sizeLabel(asset(512))).toBe('512 bytes');
    });

    it('prints a stored photograph in kilobytes', () => {
      // Whole kilobytes past ten units, one decimal below — the existing rule.
      expect(sizeLabel(asset(26_395))).toBe('26 KB');
      expect(sizeLabel(asset(5_600))).toBe('5.5 KB');
    });

    it('prints a large original in megabytes', () => {
      expect(sizeLabel(asset(531_951))).toBe('519 KB');
      expect(sizeLabel(asset(4_200_000))).toBe('4 MB');
    });
  });

  describe('an unmeasured file says so instead of claiming zero', () => {
    it('never prints "0 bytes" for a linked picture', () => {
      expect(sizeLabel(asset(null, true))).not.toBe('0 bytes');
    });

    it('says where a linked picture actually lives', () => {
      expect(sizeLabel(asset(null, true))).toBe('Stored somewhere else');
    });

    it('says the size is missing for a file that IS stored here', () => {
      // A different fault from a linked picture, and worth telling apart: this
      // one is a gap in our own record rather than a file we never held.
      expect(sizeLabel(asset(null, false))).toBe('Size not recorded');
    });
  });

  it('distinguishes the two reasons a size is missing', () => {
    expect(sizeLabel(asset(null, true))).not.toBe(sizeLabel(asset(null, false)));
  });
});

describe('formatBytes', () => {
  // Kept for real numbers; `sizeLabel` is what decides whether to call it.
  it('rounds to one decimal below ten units and none above', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(20_480)).toBe('20 KB');
  });

  it('caps at gigabytes rather than inventing a unit', () => {
    expect(formatBytes(5 * 1024 ** 4)).toContain('GB');
  });
});

// What the "Used in" line and the disabled Delete say (issue 381). The count is
// COUNTED server-side now; these pin that the screen names the KINDS, so an owner
// told she cannot delete a file also learns which screen to open to fix that.
describe('usedInLabel', () => {
  const none = {
    products: 0,
    content: 0,
    customers: 0,
    authors: 0,
    staffDocuments: 0,
    expenses: 0,
  };

  it('is null when nothing is counted, so the caller can say what it cannot see', () => {
    expect(usedInLabel({ usageCount: 0, usage: none })).toBeNull();
  });

  it('names one kind on its own', () => {
    expect(usedInLabel({ usageCount: 2, usage: { ...none, products: 2 } })).toBe(
      '2 product photos'
    );
  });

  it('names every kind in use, singular where there is one', () => {
    expect(
      usedInLabel({ usageCount: 4, usage: { ...none, products: 2, content: 1, authors: 1 } })
    ).toBe('2 product photos, 1 page or article and 1 author profile');
  });

  it('falls back to a plain count when the kinds were not sent', () => {
    expect(usedInLabel({ usageCount: 1, usage: null })).toBe('1 place on your site');
  });
});
