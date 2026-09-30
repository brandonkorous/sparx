// The picker's asset shape reads what the media route actually sends.
// Focal point is nested on reads; the flat spelling belongs to the PATCH body.

import { describe, expect, it } from 'vitest';

import { toAsset } from './media';

type Wire = Parameters<typeof toAsset>[0];

const wire = (patch: Partial<Wire>): Wire => ({
  id: 'a1',
  original_filename: 'IMG_4471.jpg',
  mime_type: 'image/jpeg',
  status: 'ready',
  original_url: null,
  variants: [],
  ...patch,
});

describe('toAsset', () => {
  it('keeps the focal point the owner chose', () => {
    const asset = toAsset(wire({ focal_point: { x: 0.2, y: 0.8 } }));
    expect(asset.focalX).toBe(0.2);
    expect(asset.focalY).toBe(0.8);
  });

  it('falls back to dead centre when none is sent', () => {
    const asset = toAsset(wire({}));
    expect([asset.focalX, asset.focalY]).toEqual([0.5, 0.5]);
  });

  it('carries alt text, and never substitutes the filename', () => {
    expect(toAsset(wire({ alt_text: 'A kale leaf' })).altText).toBe('A kale leaf');
    expect(toAsset(wire({ alt_text: null })).altText).toBeNull();
  });
});
