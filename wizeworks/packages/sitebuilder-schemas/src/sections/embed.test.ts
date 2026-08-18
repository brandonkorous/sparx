import { describe, it, expect } from 'vitest';
import { resolveEmbed, EmbedConfig } from './embed';

describe('resolveEmbed', () => {
  it('returns null for empty / non-http input', () => {
    expect(resolveEmbed('')).toBeNull();
    expect(resolveEmbed('   ')).toBeNull();
    expect(resolveEmbed(null)).toBeNull();
    expect(resolveEmbed('not a url')).toBeNull();
    expect(resolveEmbed('javascript:alert(1)')).toBeNull();
    expect(resolveEmbed('data:text/html,<script>')).toBeNull();
  });

  it('normalizes YouTube watch / short / youtu.be / shorts URLs to /embed', () => {
    const expected = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
    expect(resolveEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.src).toBe(expected);
    expect(resolveEmbed('https://youtu.be/dQw4w9WgXcQ')?.src).toBe(expected);
    expect(resolveEmbed('https://www.youtube.com/shorts/dQw4w9WgXcQ')?.src).toBe(expected);
    expect(resolveEmbed('https://www.youtube.com/embed/dQw4w9WgXcQ')?.src).toBe(expected);
    expect(resolveEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.provider).toBe('youtube');
  });

  it('normalizes Vimeo URLs to the player embed', () => {
    expect(resolveEmbed('https://vimeo.com/76979871')?.src).toBe(
      'https://player.vimeo.com/video/76979871'
    );
    expect(resolveEmbed('https://player.vimeo.com/video/76979871')?.src).toBe(
      'https://player.vimeo.com/video/76979871'
    );
  });

  it('passes a Google Maps "Embed a map" iframe src through unchanged', () => {
    const pb = 'https://www.google.com/maps/embed?pb=!1m18!2sSomePlace';
    const r = resolveEmbed(pb);
    expect(r?.provider).toBe('google-maps');
    expect(r?.src).toBe(pb);
  });

  it('builds a keyless classic embed from a Maps place / query URL', () => {
    const place = resolveEmbed('https://www.google.com/maps/place/Visalia,+CA');
    expect(place?.provider).toBe('google-maps');
    expect(place?.src).toContain('output=embed');
    expect(place?.src).toContain('Visalia');

    const query = resolveEmbed('https://maps.google.com/?q=1600+Amphitheatre+Parkway');
    expect(query?.src).toContain('output=embed');
    expect(query?.src).toContain('Amphitheatre');
  });

  it('passes any other https URL through as a sandboxed generic embed', () => {
    const r = resolveEmbed('https://calendly.com/acme/intro');
    expect(r?.provider).toBe('generic');
    expect(r?.src).toBe('https://calendly.com/acme/intro');
    expect(r?.allowFullScreen).toBe(true);
  });

  it('config defaults to a 16:9, wide, empty embed', () => {
    const cfg = EmbedConfig.parse({});
    expect(cfg.url).toBe('');
    expect(cfg.aspect).toBe('16:9');
    expect(cfg.width).toBe('wide');
  });
});
