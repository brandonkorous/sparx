import { describe, expect, it } from 'vitest';

import type { MediaRef } from '../types.js';
import {
  appendLink,
  deriveTitle,
  firstImageUrl,
  firstVideoUrl,
  imageUrls,
  isImageUrl,
} from './_media.js';

// The shared media/link helpers every image-capable adapter relies on (docs/133 §8).

const img = (url: string): MediaRef => ({ url, kind: 'image' });
const vid = (url: string): MediaRef => ({ url, kind: 'video' });

describe('isImageUrl', () => {
  it('recognizes image extensions, ignoring query strings and fragments', () => {
    expect(isImageUrl('https://cdn/x.jpg')).toBe(true);
    expect(isImageUrl('https://cdn/x.JPEG?v=2')).toBe(true);
    expect(isImageUrl('https://cdn/x.png#a')).toBe(true);
    expect(isImageUrl('https://cdn/x.webp')).toBe(true);
    expect(isImageUrl('https://cdn/clip.mp4')).toBe(false);
    expect(isImageUrl('https://cdn/doc.pdf')).toBe(false);
  });

  // Why this may no longer DECIDE what an attachment is. A stock/CDN URL carries no
  // extension, so kind-by-extension called a jpeg "not an image" — which dropped it
  // from Facebook posts entirely and, via the old `!isImageUrl(u)` video predicate,
  // handed the same photo to the VIDEO upload path on Instagram/Threads/TikTok/YouTube.
  it('cannot see an extensionless stock URL as an image — hence MediaRef.kind', () => {
    expect(isImageUrl('https://images.unsplash.com/photo-1588850561407-ed78c282e89b')).toBe(false);
  });
});

describe('firstImageUrl / imageUrls / firstVideoUrl', () => {
  it('classify by kind, not by extension', () => {
    const media = [vid('https://cdn/clip'), img('https://images.unsplash.com/photo-123')];
    expect(firstImageUrl(media)).toBe('https://images.unsplash.com/photo-123');
    expect(firstVideoUrl(media)).toBe('https://cdn/clip');
    expect(imageUrls(media)).toEqual(['https://images.unsplash.com/photo-123']);
  });

  it('firstImageUrl returns the first image or null', () => {
    expect(firstImageUrl([vid('https://cdn/clip.mp4'), img('https://cdn/a.png')])).toBe(
      'https://cdn/a.png'
    );
    expect(firstImageUrl([vid('https://cdn/clip.mp4')])).toBeNull();
    expect(firstImageUrl([])).toBeNull();
  });

  it('firstVideoUrl returns null when every attachment is an image', () => {
    expect(firstVideoUrl([img('https://cdn/a.png'), img('https://cdn/b.jpg')])).toBeNull();
  });

  it('imageUrls keeps only images, in order', () => {
    expect(
      imageUrls([img('https://cdn/a.jpg'), vid('https://cdn/clip.mp4'), img('https://cdn/b.png')])
    ).toEqual(['https://cdn/a.jpg', 'https://cdn/b.png']);
  });
});

describe('appendLink', () => {
  it('uses the link alone when there is no text', () => {
    expect(appendLink('', 'https://x')).toBe('https://x');
  });
  it('appends the link on its own paragraph', () => {
    expect(appendLink('Big news', 'https://x')).toBe('Big news\n\nhttps://x');
  });
  it('does not double a link already present', () => {
    expect(appendLink('See https://x now', 'https://x')).toBe('See https://x now');
  });
});

describe('deriveTitle', () => {
  it('takes the first non-empty line, whitespace-collapsed', () => {
    expect(deriveTitle('\n  Aurora   Jacket \nmore body', 100)).toBe('Aurora Jacket');
  });
  it('truncates past the max with an ellipsis', () => {
    const t = deriveTitle('x'.repeat(50), 10);
    expect(t.length).toBeLessThanOrEqual(10);
    expect(t.endsWith('…')).toBe(true);
  });
  it('falls back when the body is empty', () => {
    expect(deriveTitle('   \n  ', 100)).toBe('New post');
    expect(deriveTitle('', 100, 'Untitled')).toBe('Untitled');
  });
});
