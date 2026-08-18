import { describe, expect, it } from 'vitest';
import {
  BRAND_PALETTE_KIND,
  BRAND_PALETTE_VERSION,
  parseBrandPalette,
  serializeBrandPalette,
} from './brand-palette';

describe('brand-palette interchange format', () => {
  it('round-trips serialize → parse', () => {
    const json = serializeBrandPalette({
      name: 'brand',
      source: 'https://sparx.works/tools/color-palette',
      primary: { fill: '#6366F1', content: '#FFFFFF' },
      accents: [
        { fill: '#F1EE63', content: '#000000' },
        { fill: '#A763F1', content: '#FFFFFF' },
      ],
    });
    const res = parseBrandPalette(json);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.palette.sparx).toBe(BRAND_PALETTE_KIND);
    expect(res.palette.version).toBe(BRAND_PALETTE_VERSION);
    expect(res.palette.name).toBe('brand');
    expect(res.palette.primary).toEqual({ fill: '#6366F1', content: '#FFFFFF' });
    expect(res.palette.accents).toHaveLength(2);
    expect(res.palette.accents[1]).toEqual({ fill: '#A763F1', content: '#FFFFFF' });
  });

  it('rejects non-JSON', () => {
    const res = parseBrandPalette('not json {');
    expect(res.ok).toBe(false);
  });

  it('rejects a foreign object (wrong kind)', () => {
    const res = parseBrandPalette(JSON.stringify({ colors: ['#fff'] }));
    expect(res.ok).toBe(false);
  });

  it('rejects a newer format version', () => {
    const res = parseBrandPalette(
      JSON.stringify({ sparx: BRAND_PALETTE_KIND, version: 999, primary: { fill: '#000000' } })
    );
    expect(res.ok).toBe(false);
  });

  it('rejects a palette with no valid primary', () => {
    const res = parseBrandPalette(
      JSON.stringify({ sparx: BRAND_PALETTE_KIND, version: 1, primary: { fill: 'nope' } })
    );
    expect(res.ok).toBe(false);
  });

  it('normalizes 3-digit hex and fills a missing content with a readable color', () => {
    const res = parseBrandPalette(
      JSON.stringify({ sparx: BRAND_PALETTE_KIND, version: 1, primary: { fill: '#fff' } })
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.palette.primary.fill).toBe('#FFFFFF');
    // White fill → black is the readable foreground.
    expect(res.palette.primary.content).toBe('#000000');
  });

  it('drops malformed accent entries instead of failing', () => {
    const res = parseBrandPalette(
      JSON.stringify({
        sparx: BRAND_PALETTE_KIND,
        version: 1,
        primary: { fill: '#123456', content: '#FFFFFF' },
        accents: [{ fill: '#abcdef' }, { fill: 'garbage' }, { nope: true }],
      })
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.palette.accents).toHaveLength(1);
    expect(res.palette.accents[0]?.fill).toBe('#ABCDEF');
  });
});
