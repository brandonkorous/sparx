import { describe, expect, it } from 'vitest';
import { photoPanelStyle } from './photo-panel';

describe('photoPanelStyle', () => {
  it('uses the surface color and no tone when there is no image', () => {
    expect(photoPanelStyle({ surfaceBg: 'var(--st-base-200)' })).toEqual({
      background: 'var(--st-base-200)',
    });
  });

  it('falls back to transparent with no image and no surface', () => {
    expect(photoPanelStyle({})).toEqual({ background: 'transparent' });
  });

  it('layers a scrim above the image url for the gradient overlay', () => {
    const s = photoPanelStyle({ image: 'https://x.test/a.jpg', overlay: 'gradient' });
    expect(s.backgroundImage).toContain('url("https://x.test/a.jpg")');
    expect(s.backgroundImage).toContain('linear-gradient(to bottom');
    expect(s.backgroundSize).toBe('cover');
  });

  it('omits the scrim when overlay is none', () => {
    const s = photoPanelStyle({ image: 'https://x.test/a.jpg', overlay: 'none' });
    expect(s.backgroundImage).toBe('url("https://x.test/a.jpg")');
  });

  it('applies the text tone color', () => {
    expect(photoPanelStyle({ image: 'https://x.test/a.jpg', tone: 'light' }).color).toBe('#ffffff');
    expect(photoPanelStyle({ tone: 'dark', surfaceBg: 'transparent' }).color).toBe('#0b0b0c');
  });

  it('sanitizes quotes/backslashes out of the image url', () => {
    const s = photoPanelStyle({ image: 'a".jpg' });
    expect(s.backgroundImage).toBe('url("a.jpg")');
  });
});
