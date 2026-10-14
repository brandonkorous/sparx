// The site's own pages its switches refuse, which the storefront drops links to. A
// journal that switched Selling off kept `/search` (search is the whole site's, issue
// 945), yet its footer's Search link vanished: this kept its own copy of the rule
// (issue 947).

import { describe, expect, it } from 'vitest';

import { hiddenPathsOf } from './site-hidden-paths';

const core = (component: string) => ({
  kind: 'element',
  tag: 'div',
  children: [{ kind: 'host', component }],
});

const page = (slug: string, tree: unknown, recordType: string | null = null) => ({
  slug,
  recordType,
  publishedTree: null,
  silicaPublishedTree: tree,
});

const journal = new Set(['commerce', 'scheduling']);

describe('hiddenPathsOf', () => {
  it('hides the shop and keeps search, sign-in and the home page', () => {
    const hidden = hiddenPathsOf(
      [
        page('', core('commerce.plp')),
        page('shop', core('commerce.plp')),
        page('search', core('commerce.search')),
        page('account/login', core('commerce.auth')),
        page('journal', core('cms.article-body')),
      ],
      journal
    );
    expect(hidden).toEqual(['/shop']);
  });

  it('hides a record page by its own record type', () => {
    expect(hiddenPathsOf([page('/products/:handle', null, 'commerce.product')], journal)).toEqual([
      '/products/:handle',
    ]);
  });
});
