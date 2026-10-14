// The unsubscribe pages say who and which address, and never let a name write markup
// (piggles persona issue 983).

import { describe, expect, it } from 'vitest';

import { unsubscribeAskPage, unsubscribedPage } from './unsubscribe-page.js';

describe('the unsubscribe pages', () => {
  it('name the business and the address', () => {
    const page = unsubscribedPage({ business: 'The Marrow Review', email: 'owen@example.net' });
    expect(page).toContain('from <strong>The Marrow Review</strong>');
    expect(page).toContain('<strong>owen@example.net</strong>');
  });

  it('say "this sender" rather than invent a name', () => {
    expect(unsubscribedPage({ business: null, email: 'a@b.test' })).toContain('from this sender');
  });

  it('escape a business name', () => {
    const page = unsubscribeAskPage(
      { business: 'Fish & <b>Chips</b>', email: 'a@b.test' },
      '/x?token=1&y="2"'
    );
    expect(page).toContain('Fish &amp; &lt;b&gt;Chips&lt;/b&gt;');
    expect(page).toContain('action="/x?token=1&amp;y=&quot;2&quot;"');
  });
});
