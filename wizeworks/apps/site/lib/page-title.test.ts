import { describe, expect, it } from 'vitest';

import { metadataTitle, namesTheSite, socialTitle } from './page-title';

describe('namesTheSite', () => {
  it('sees the shop at the end, the way an owner writes it', () => {
    expect(namesTheSite('What we bake — Thistle & Rye', 'Thistle & Rye')).toBe(true);
  });

  it('sees the shop at the start too', () => {
    expect(namesTheSite('Thistle & Rye opening hours', 'Thistle & Rye')).toBe(true);
  });

  it('does not see one that is not there', () => {
    expect(namesTheSite('What we bake', 'Thistle & Rye')).toBe(false);
  });

  it('ignores capitals, because nobody types a name the same way twice', () => {
    expect(namesTheSite('about thistle & rye', 'Thistle & Rye')).toBe(true);
  });

  it('does not match a name buried inside a longer word', () => {
    expect(namesTheSite('Ryestone flour', 'Rye')).toBe(false);
  });

  it('leaves very short names alone rather than guessing', () => {
    // "Co" inside "Cookies" would strip the brand off a title that never had it.
    expect(namesTheSite('Cookies and cake', 'Co')).toBe(false);
  });
});

describe('metadataTitle', () => {
  it('lets the layout append the shop when the title has no shop in it', () => {
    expect(metadataTitle('What we bake', 'Thistle & Rye')).toBe('What we bake');
  });

  it('stops the layout appending a second one', () => {
    expect(metadataTitle('What we bake — Thistle & Rye', 'Thistle & Rye')).toEqual({
      absolute: 'What we bake — Thistle & Rye',
    });
  });
});

describe('socialTitle', () => {
  it('adds the shop, because a card is seen with nothing around it', () => {
    expect(socialTitle('What we bake', 'Thistle & Rye')).toBe('What we bake · Thistle & Rye');
  });

  it('does not add a second one', () => {
    expect(socialTitle('What we bake — Thistle & Rye', 'Thistle & Rye')).toBe(
      'What we bake — Thistle & Rye'
    );
  });
});
