import { describe, expect, it } from 'vitest';

import { appendLink, deriveTitle, firstImageUrl, imageUrls, isImageUrl } from './_media.js';

// The shared media/link helpers every image-capable adapter relies on (docs/133 §8).

describe('isImageUrl / firstImageUrl / imageUrls', () => {
  it('recognizes image extensions, ignoring query strings and fragments', () => {
    expect(isImageUrl('https://cdn/x.jpg')).toBe(true);
    expect(isImageUrl('https://cdn/x.JPEG?v=2')).toBe(true);
    expect(isImageUrl('https://cdn/x.png#a')).toBe(true);
    expect(isImageUrl('https://cdn/x.webp')).toBe(true);
    expect(isImageUrl('https://cdn/clip.mp4')).toBe(false);
    expect(isImageUrl('https://cdn/doc.pdf')).toBe(false);
  });

  it('firstImageUrl returns the first image or null', () => {
    expect(firstImageUrl(['https://cdn/clip.mp4', 'https://cdn/a.png'])).toBe('https://cdn/a.png');
    expect(firstImageUrl(['https://cdn/clip.mp4'])).toBeNull();
    expect(firstImageUrl([])).toBeNull();
  });

  it('imageUrls keeps only images, in order', () => {
    expect(imageUrls(['https://cdn/a.jpg', 'https://cdn/clip.mp4', 'https://cdn/b.png'])).toEqual([
      'https://cdn/a.jpg',
      'https://cdn/b.png',
    ]);
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
