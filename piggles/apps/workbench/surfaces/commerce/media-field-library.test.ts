// The picture field's library row carries what the media route sends: the
// owner's alt text and the size. Both were hard-coded to null.

import { describe, expect, it } from 'vitest';

import { toLibraryAsset } from './media-field-library';

type Wire = Parameters<typeof toLibraryAsset>[0];

const wire = (patch: Partial<Wire>): Wire => ({
  id: 'a1',
  original_filename: 'IMG_4471.jpg',
  mime_type: 'image/jpeg',
  status: 'ready',
  original_url: null,
  width: 1200,
  height: 800,
  alt_text: null,
  variants: [],
  ...patch,
});

describe('toLibraryAsset', () => {
  it('carries the alt text the owner wrote', () => {
    expect(toLibraryAsset(wire({ alt_text: 'A kale leaf' })).altText).toBe('A kale leaf');
  });

  it('is null, never the filename, when nobody wrote one', () => {
    expect(toLibraryAsset(wire({ alt_text: null })).altText).toBeNull();
    expect(toLibraryAsset(wire({ alt_text: '  ' })).altText).toBeNull();
  });

  it('carries the measured size', () => {
    const asset = toLibraryAsset(wire({}));
    expect([asset.width, asset.height]).toEqual([1200, 800]);
  });
});
