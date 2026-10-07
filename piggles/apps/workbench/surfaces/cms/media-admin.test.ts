// What a file's size says when nobody measured it (issue 380).
//
// `byte_size = 0` is not a weight. No file is zero bytes, so that column only
// ever means the size was never recorded — and 74 of Devi's 87 photographs
// carried it, every one printing a confident "0 bytes" under its thumbnail.
// Issue 330 settled the same rule for the publish weight report; these pin it
// for the library screen.

import { describe, expect, it } from 'vitest';

import {
  formatBytes,
  placeLabel,
  placeTarget,
  sizeLabel,
  tileSizeLine,
  tileUseLine,
} from './media-admin';

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

describe('what a tile says under its filename', () => {
  const pic = (usageCount: number, products = 0) => ({
    usageCount,
    usage:
      usageCount === 0
        ? null
        : {
            products,
            content: usageCount - products,
            customers: 0,
            authors: 0,
            staffDocuments: 0,
            expenses: 0,

            sitePages: 0,

            siteLayouts: 0,

            branding: 0,

            catalog: 0,

            reviews: 0,

            socialPosts: 0,

            otherRecords: 0,
          },
  });

  it('says when no use was found', () => {
    expect(tileUseLine(pic(0))).toBe('No use found');
  });

  it('names where a picture is used', () => {
    expect(tileUseLine(pic(3, 2))).toBe('In 2 product photos and 1 page or article');
  });

  it('leaves out the size of a picture kept somewhere else', () => {
    expect(tileSizeLine(asset(null, true))).toBeNull();
  });

  it('keeps a measured size and the fault of an unweighed file', () => {
    expect(tileSizeLine(asset(1536))).toBe('1.5 KB');
    expect(tileSizeLine(asset(null, false))).toBe('Size not recorded');
  });
});

describe('the places a file is used, by name (issue 932)', () => {
  const page = {
    kind: 'page',
    id: 'p1',
    name: 'Home',
    site: 'Juniper Row Journal',
    siteId: 's2',
  } as const;
  const product = {
    kind: 'product',
    id: 'x1',
    name: 'Ash Overshirt',
    site: null,
    siteId: null,
  } as const;
  const layout = {
    kind: 'layout',
    id: 'l1',
    name: 'Main',
    site: 'Lookbook',
    siteId: 's3',
  } as const;

  it('says whose site a page is on', () => {
    expect(placeLabel(page)).toBe('Home (site page on Juniper Row Journal)');
  });

  it('opens a product, an article and a page', () => {
    expect(placeTarget(product)).toEqual({
      surface: 'commerce.product.detail',
      params: { id: 'x1' },
    });
    expect(placeTarget(page)).toEqual({ surface: 'builder.page', params: { pageId: 'p1' } });
  });

  it('opens a header and footer in the site editor', () => {
    expect(placeTarget(layout)).toEqual({ surface: 'builder.layout', params: {} });
    expect(placeLabel(layout)).toBe('Header and footer “Main” on Lookbook');
  });
});
