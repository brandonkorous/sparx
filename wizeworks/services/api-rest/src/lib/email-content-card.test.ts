// P09: The Marrow Review's newsletter would have gone out with no pictures and no
// standfirsts, because the send read only a blog post's field names.
import { describe, expect, it } from 'vitest';

import { contentCard, kindFieldsOf } from './email-content-card';

const ARTICLE = kindFieldsOf({
  fields: [
    { key: 'title', type: 'text' },
    { key: 'standfirst', type: 'long_text' },
    { key: 'body', type: 'rich_text' },
    { key: 'heroImage', type: 'asset' },
    { key: 'heroCaption', type: 'text' },
  ],
});

describe('contentCard', () => {
  it('reads an article’s own names for its summary and picture', () => {
    const card = contentCard(
      {
        title: 'The last mill on the Nene',
        standfirst: 'A miller, a leat, and the last stones turning.',
        heroImage: '4da93e3e-003d-4f4c-b5b6-4e8e02704f9c',
      },
      ARTICLE
    );
    expect(card.title).toBe('The last mill on the Nene');
    expect(card.excerpt).toBe('A miller, a leat, and the last stones turning.');
    expect(card.imageId).toBe('4da93e3e-003d-4f4c-b5b6-4e8e02704f9c');
  });

  it('falls back to the kind’s first summary-shaped and picture field by type', () => {
    const fields = kindFieldsOf({
      fields: [
        { key: 'headline', type: 'text' },
        { key: 'intro', type: 'long_text' },
        { key: 'plate', type: 'asset' },
      ],
    });
    const card = contentCard({ headline: 'Rye', intro: 'Why rye.', plate: 'abc' }, fields);
    expect(card).toMatchObject({ title: 'Rye', excerpt: 'Why rye.', imageId: 'abc' });
  });

  it('still reads a blog post the way it always did', () => {
    const card = contentCard(
      { title: 'Hello', excerpt: 'First post.', featuredImage: 'img-1' },
      kindFieldsOf(null)
    );
    expect(card).toMatchObject({ title: 'Hello', excerpt: 'First post.', imageId: 'img-1' });
  });

  it('leaves a piece with no picture without one', () => {
    expect(contentCard({ title: 'No photo yet' }, ARTICLE).imageId).toBe('');
  });
});
