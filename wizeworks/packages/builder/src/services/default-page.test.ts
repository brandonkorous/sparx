// A record page nobody has published, still exactly as the platform made it, is what the
// site already shows: it is not waiting to go live (persona issue 947).

import { describe, expect, it } from 'vitest';
import { RECORD_ADDRESSES, recordPage } from '@wizeworks/silica-catalog';
import { kindAddressFromPattern } from '@wizeworks/silica-catalog';

import { showsItsDefault } from './default-page';
import { seededKindPage, type ServedKind } from './kind-pages';

const stored = (tree: unknown): unknown => JSON.parse(JSON.stringify(tree));
const author = RECORD_ADDRESSES.find((a) => a.recordType === 'cms.author')!;
const article: ServedKind = {
  key: 'article',
  name: 'Article',
  pluralName: 'Articles',
  fields: [{ key: 'title', type: 'text', label: 'Title' }],
  address: kindAddressFromPattern('/articles/{slug}')!,
};

describe('showsItsDefault', () => {
  it('is true for an untouched, never-published record page', () => {
    const row = {
      recordType: 'cms.author',
      silicaDraftTree: stored(recordPage(author).root),
      silicaPublishedTree: null,
    };
    expect(showsItsDefault(row)).toBe(true);
  });

  it('is true for an untouched, never-published kind page', () => {
    const row = {
      recordType: 'cms.article',
      silicaDraftTree: stored(seededKindPage(article)),
      silicaPublishedTree: null,
    };
    expect(showsItsDefault(row)).toBe(true);
  });

  it('is false once the owner has changed it: her change is waiting', () => {
    const draft = stored(recordPage(author).root) as { class?: string };
    draft.class = 'flex flex-col gap-12';
    expect(
      showsItsDefault({
        recordType: 'cms.author',
        silicaDraftTree: draft,
        silicaPublishedTree: null,
      })
    ).toBe(false);
  });

  it('is false for a kind page the owner has edited', () => {
    const draft = stored(seededKindPage(article)) as { class?: string };
    draft.class = 'flex flex-col gap-12';
    expect(
      showsItsDefault({
        recordType: 'cms.article',
        silicaDraftTree: draft,
        silicaPublishedTree: null,
      })
    ).toBe(false);
  });

  it('is false for a published page, and for an ordinary page', () => {
    const tree = stored(recordPage(author).root);
    expect(
      showsItsDefault({
        recordType: 'cms.author',
        silicaDraftTree: tree,
        silicaPublishedTree: tree,
      })
    ).toBe(false);
    expect(
      showsItsDefault({ recordType: null, silicaDraftTree: tree, silicaPublishedTree: null })
    ).toBe(false);
  });
});
