// A reader finds a piece by a word they remember from it, and that word is in the
// standfirst or the body, not the headline (P09: "sluice" found nothing).

import { describe, expect, it } from 'vitest';

import { ENTRY_TEXT_MAX, entryText, kindFields } from './entry-text';

const ARTICLE = kindFields({
  fields: [
    { key: 'title', type: 'text' },
    { key: 'standfirst', type: 'long_text' },
    { key: 'body', type: 'rich_text' },
    { key: 'hero', type: 'asset' },
    { key: 'section', type: 'enum' },
    { key: 'photograph_by', type: 'author' },
  ],
});

describe('entryText', () => {
  it('holds the standfirst and every word of the body, without markup', () => {
    const text = entryText(
      {
        title: 'The last mill on the Nene',
        standfirst: 'Seven water mills once worked the river.',
        body: '<p>The sluice at Ashton opens at half past seven.</p><p>By ten the sacks are tied.</p>',
        section: 'field',
        photograph_by: '7b034c5c-ffe5-4d3f-b463-9772b76f8bcf',
      },
      ARTICLE,
      'title'
    );
    expect(text).toContain('sluice');
    expect(text).toContain('Seven water mills');
    expect(text).toContain('By ten the sacks are tied.');
    expect(text).not.toContain('<p>');
  });

  it('reads a body stored as an editor document, paragraph by paragraph', () => {
    const text = entryText(
      {
        title: 'The last mill on the Nene',
        body: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'The sluice at Ashton opens.' }] },
            { type: 'heading', content: [{ type: 'text', text: 'A trade learned twice' }] },
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'By ten the ' },
                { type: 'text', marks: [{ type: 'bold' }], text: 'sacks' },
                { type: 'text', text: ' are tied.' },
              ],
            },
          ],
        },
      },
      ARTICLE,
      'title'
    );
    expect(text).toBe(
      'The sluice at Ashton opens.\n\nA trade learned twice\n\nBy ten the sacks are tied.'
    );
  });

  it('leaves out the headline, choices and ids, which are not prose', () => {
    const text = entryText(
      { title: 'Headline', standfirst: 'Words.', section: 'field', photograph_by: 'abc' },
      ARTICLE,
      'title'
    );
    expect(text).toBe('Words.');
  });

  it('still reads excerpt and summary when the kind has no fields to read', () => {
    expect(entryText({ excerpt: 'An excerpt.', other: 'Not this.' }, [])).toBe('An excerpt.');
  });

  it('caps a very long piece', () => {
    const text = entryText({ body: 'word '.repeat(20_000) }, ARTICLE, 'title');
    expect(text?.length).toBe(ENTRY_TEXT_MAX);
  });

  it('says nothing when there is nothing to say', () => {
    expect(entryText({ title: 'Only a headline' }, ARTICLE, 'title')).toBeUndefined();
  });
});

describe('kindFields', () => {
  it('reads nothing from a malformed schema', () => {
    expect(kindFields(null)).toEqual([]);
    expect(kindFields({ fields: 'nope' })).toEqual([]);
    expect(kindFields({ fields: [{ key: 1 }, { key: 'a', type: 'text' }] })).toEqual([
      { key: 'a', type: 'text' },
    ]);
  });
});
