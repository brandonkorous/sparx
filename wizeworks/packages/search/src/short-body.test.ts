// The index keeps a whole article so a reader finds it by any word in it; a search
// ANSWER carries a lead-in, not twenty whole articles (P09).

import { describe, expect, it } from 'vitest';

import { ANSWER_BODY_MAX, withShortBody } from './search';
import type { UniversalSearchDocument } from './schemas/entities';

const doc = (body?: string): UniversalSearchDocument => ({
  id: 't:cms_entry:1',
  tenant_id: 't',
  entity_type: 'cms_entry',
  module: 'cms',
  record_id: '1',
  title: 'The last mill on the Nene',
  body,
  status: 'published',
  url: '/cms/1',
  created_at: 0,
  updated_at: 0,
});

describe('withShortBody', () => {
  it('cuts a whole article to a lead-in at a word', () => {
    const out = withShortBody(doc('word '.repeat(2_000)));
    expect(out.body!.length).toBeLessThanOrEqual(ANSWER_BODY_MAX + 1);
    expect(out.body!.endsWith('word…')).toBe(true);
  });

  it('leaves a short body and a missing one alone', () => {
    const short = doc('Seven water mills.');
    expect(withShortBody(short)).toBe(short);
    const none = doc(undefined);
    expect(withShortBody(none)).toBe(none);
  });
});
