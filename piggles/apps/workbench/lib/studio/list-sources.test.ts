import { describe, expect, it } from 'vitest';

import type { BindingCatalog } from './site-data';
import { emailWritingKinds, writingListChoices } from './list-sources';

const list = (key: string, label: string, used?: boolean) => ({
  key,
  label,
  module: 'cms' as const,
  cardinality: 'array' as const,
  recordType: key,
  fields: [],
  ...(used !== undefined ? { used } : {}),
});

const catalog = {
  sources: [
    list('cms.article', 'Articles', true),
    list('cmsWhere.article.section.field', 'Articles in Field', true),
    list('cms.blog_post', 'Blog posts', false),
    list('cms.job_posting', 'Careers', false),
    list('commerce.product', 'All products'),
  ],
} as unknown as BindingCatalog;

describe('writingListChoices', () => {
  it('offers the writing this business uses, and the list it shows now', () => {
    expect(writingListChoices(catalog, 'cms.blog_post').map((c) => c.label)).toEqual([
      'Articles',
      'Articles in Field',
      'Blog posts',
    ]);
  });

  it('leaves out kinds nobody wrote in, and every product list', () => {
    const labels = writingListChoices(catalog, 'cms.article').map((c) => c.label);
    expect(labels).toEqual(['Articles', 'Articles in Field']);
  });

  it('offers nothing for a list that is not writing', () => {
    expect(writingListChoices(catalog, 'commerce.product')).toEqual([]);
  });
});

// P09: the email designer's "Latest …" blocks.
describe('emailWritingKinds', () => {
  it('offers the kinds she writes in, never a section filter, a product list or her pages', () => {
    const withPages = {
      sources: [...catalog.sources, list('cms.page', 'Pages', true)],
    };
    expect(emailWritingKinds(withPages)).toEqual([{ ref: 'cms.article', label: 'Articles' }]);
  });
});
