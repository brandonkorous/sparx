import { describe, expect, it } from 'vitest';

import { CreateProductInput, UpsertProductTranslationInput } from './products';
import { looksLikeMarkup, PlainTextField, plainText } from './plain-text';

describe('looksLikeMarkup', () => {
  it('sees a real tag', () => {
    expect(looksLikeMarkup('<p>Hello</p>')).toBe(true);
  });

  it('does not see a less-than sign in a sentence', () => {
    expect(looksLikeMarkup('Fits anything < 3 inches across.')).toBe(false);
  });

  it('does not see arithmetic', () => {
    expect(looksLikeMarkup('a < b and b > c')).toBe(false);
  });
});

describe('plainText', () => {
  it('leaves ordinary words exactly as they are', () => {
    const written = 'Two days of slow rise.\n\nBaked dark, with an open crumb.';
    expect(plainText(written)).toBe(written);
  });

  it('turns the sample packs paragraphs into blank lines', () => {
    expect(plainText('<p>A hard enamel pin.</p><p>About 1.25 inches.</p>')).toBe(
      'A hard enamel pin.\n\nAbout 1.25 inches.'
    );
  });

  it('keeps the paragraphs apart rather than running them together', () => {
    // Collapsing the tags to nothing would give one sentence with no gap, which
    // the renderer would draw as a single block.
    expect(plainText('<p>One.</p><p>Two.</p>')).not.toBe('One.Two.');
  });

  it('keeps the words inside bold and headings', () => {
    expect(plainText('<p>Ships <strong>free</strong> over $50.</p>')).toBe('Ships free over $50.');
  });

  it('gives a heading and its list items their own lines', () => {
    expect(plainText("<h3>What's included</h3><ul><li>A crawl</li><li>The fixes</li></ul>")).toBe(
      "What's included\n\nA crawl\n\nThe fixes"
    );
  });

  it('turns a line break into a break, not a space', () => {
    expect(plainText('First line<br>Second line')).toBe('First line\n\nSecond line');
  });

  it('puts an escaped ampersand back', () => {
    expect(plainText('<p>Salt &amp; pepper</p>')).toBe('Salt & pepper');
  });

  it('reads an empty field as empty, not as the word null', () => {
    expect(plainText(null)).toBe('');
    expect(plainText(undefined)).toBe('');
  });

  it('never leaves a tag behind for a shopper to read', () => {
    expect(plainText('<div><p>Anything at all</p></div>')).not.toContain('<');
  });
});

describe('the naive strip this replaced', () => {
  // `/<[^>]*>/g` matches from a `<` to the NEXT `>` wherever they fall, so an
  // ordinary sentence using both signs loses the words between them. Two consoles
  // shipped that version against this field.
  const naive = (t: string) => t.replace(/<[^>]*>/g, ' ');

  it('ate the words between a less-than and a greater-than', () => {
    const written = 'Fits anything < 3 inches across, weighs > 2oz.';
    expect(naive(written)).not.toContain('3 inches across');
    expect(plainText(written)).toBe(written);
  });

  it('left an escaped ampersand on the screen', () => {
    expect(naive('<p>Salt &amp; pepper</p>')).toContain('&amp;');
    expect(plainText('<p>Salt &amp; pepper</p>')).toBe('Salt & pepper');
  });
});

describe('PlainTextField', () => {
  const field = PlainTextField(50);

  it('stores what the column is supposed to hold', () => {
    expect(field.parse('<p>A hard enamel pin.</p>')).toBe('A hard enamel pin.');
  });

  it('measures the length of what was SENT, not of what is kept', () => {
    // 60 characters of markup that strips down to 8. Telling her it fit would be
    // accepting a field she cannot get back.
    const long = `<p>${'x'.repeat(8)}</p>${'<br>'.repeat(12)}`;
    expect(long.length).toBeGreaterThan(50);
    expect(() => field.parse(long)).toThrow();
  });
});

describe('a product description is plain text at the wire', () => {
  it('normalizes on create', () => {
    const parsed = CreateProductInput.parse({
      title: 'Enamel pin',
      description: '<p>A hard enamel pin.</p><p>About 1.25 inches.</p>',
    });
    expect(parsed.description).toBe('A hard enamel pin.\n\nAbout 1.25 inches.');
  });

  it('leaves an ordinary description exactly as written', () => {
    const written = 'Two days of slow rise.\n\nBaked dark, with an open crumb.';
    expect(CreateProductInput.parse({ title: 'Loaf', description: written }).description).toBe(
      written
    );
  });

  it('still lets a save clear the field', () => {
    expect(CreateProductInput.parse({ title: 'Loaf', description: null }).description).toBeNull();
  });

  it('normalizes a translation too, so no locale keeps the tags', () => {
    const parsed = UpsertProductTranslationInput.parse({
      locale: 'es',
      title: 'Pin esmaltado',
      description: '<p>Un pin de esmalte duro.</p>',
    });
    expect(parsed.description).toBe('Un pin de esmalte duro.');
  });
});
