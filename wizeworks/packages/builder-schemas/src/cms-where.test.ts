// A journal's sections as lists a page can show: "Articles in Field".
//
// A section is a choice on each piece. Until these sources existed a page could list
// every article or none, so a journal had no section pages to put in its header.

import { describe, expect, it } from 'vitest';
import { el, repeat } from '@wizeworks/silicaui-html';

import { cmsWhereKey, mapCmsContentType, parseCmsWhereKey } from './binding';
import { collectSilicaSourceNeeds } from './silica-data-needs';

const ARTICLE = {
  key: 'article',
  name: 'Article',
  pluralName: 'Articles',
  fields: [
    { key: 'title', label: 'Title', type: 'text' },
    {
      key: 'section',
      label: 'Section',
      type: 'enum',
      options: [
        { label: 'Field', value: 'field' },
        { label: 'Ledger', value: 'ledger' },
      ],
    },
    {
      key: 'tags',
      label: 'Tags',
      type: 'enum',
      multiple: true,
      options: [{ label: 'Mills', value: 'mills' }],
    },
  ],
};

describe('section lists', () => {
  it('offers one list per option of a single-choice field, named in her words', () => {
    const lists = mapCmsContentType(ARTICLE).filter((s) => s.cardinality === 'array');
    expect(lists.map((s) => [s.key, s.label])).toEqual([
      ['cms.article', 'Articles'],
      ['cmsWhere.article.section.field', 'Articles in Field'],
      ['cmsWhere.article.section.ledger', 'Articles in Ledger'],
    ]);
  });

  it('reads its key back, and refuses any other', () => {
    expect(parseCmsWhereKey(cmsWhereKey('article', 'section', 'field'))).toEqual({
      type: 'article',
      field: 'section',
      value: 'field',
    });
    expect(parseCmsWhereKey('cms.article')).toBeNull();
    expect(parseCmsWhereKey('cmsWhere.article.section')).toBeNull();
  });

  it('is fetched as its own list, with its own limit', () => {
    const grid = repeat(el('div', ''), 'cmsWhere.article.section.field');
    (grid as { data: { limit?: number } }).data.limit = 6;
    const needs = collectSilicaSourceNeeds(el('div', '', { children: [grid] }));
    expect(needs.cmsWhere).toEqual([
      { key: 'cmsWhere.article.section.field', type: 'article', field: 'section', value: 'field' },
    ]);
    expect(needs.limits['cmsWhere.article.section.field']).toBe(6);
    expect(needs.cmsTypes).toEqual([]);
  });
});
